import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { io as connectClient } from "socket.io-client";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  secret,
  acceptedRide,
  rideInput,
} from "./helpers.js";
import { RideShare, Ride } from "../src/models/index.js";
import { updateTrackedLocation } from "../src/services/tracking.js";
import { createHttpServer } from "../src/http-server.js";
let runtime, url, clients;
beforeAll(setup);
afterAll(cleanup);
beforeEach(async () => {
  await reset();
  clients = [];
  runtime = createHttpServer({ jwtSecret: secret, logging: false });
  await new Promise((resolve) =>
    runtime.server.listen(0, "127.0.0.1", resolve),
  );
  url = `http://127.0.0.1:${runtime.server.address().port}`;
});
afterEach(async () => {
  for (const socket of clients) socket.disconnect();
  if (runtime) await new Promise((resolve) => runtime.io.close(resolve));
});
async function connect(namespace = "/shared-rides", auth = {}) {
  const socket = connectClient(url + namespace, {
    auth,
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false,
    forceNew: true,
    timeout: 3000,
  });
  clients.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });
  return socket;
}
const ack = (socket, event, data) =>
  socket.timeout(5000).emitWithAck(event, data);
const join = (socket, token) => ack(socket, "share:join", { token });
function event(socket, name, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const listener = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(name, listener);
      reject(new Error(`Missing ${name}`));
    }, timeout);
    socket.once(name, listener);
  });
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
const gps = (id) => ({
  rideId: String(id),
  latitude: 51.501,
  longitude: -0.121,
  heading: 120,
  speed: 8,
});
async function shared() {
  const ride = await acceptedRide();
  const response = await api(
    "rider",
    "post",
    `/api/rides/${ride._id}/share`,
    {},
  );
  expect(response.status).toBe(201);
  return { ride, ...response.body.data };
}
async function secondShare() {
  const requested = await api("other", "post", "/api/rides", {
    ...rideInput,
    destination: {
      ...rideInput.destination,
      address: "Second ride destination",
    },
  });
  expect(requested.status).toBe(201);
  const ride = requested.body.data;
  expect(
    (await api("driver2", "patch", `/api/rides/${ride._id}/accept`)).status,
  ).toBe(200);
  const response = await api(
    "other",
    "post",
    `/api/rides/${ride._id}/share`,
    {},
  );
  expect(response.status).toBe(201);
  return { ride, ...response.body.data };
}
const shareRooms = () =>
  [...runtime.io.of("/shared-rides").adapter.rooms.keys()].filter((key) =>
    key.startsWith("share:"),
  );

describe("public sharing subscription concurrency", () => {
  it("serializes concurrent joins so both acknowledgements succeed and only the last ride remains subscribed", async () => {
    const a = await shared();
    const b = await secondShare();
    const viewer = await connect();
    const results = await Promise.all([
      join(viewer, a.token),
      join(viewer, b.token),
    ]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(shareRooms()).toHaveLength(1);
    const received = event(viewer, "share:location");
    await updateTrackedLocation(actors.driver2.user, gps(b.ride._id), 5000);
    expect((await received).latitude).toBe(51.501);
  });
});

describe("public namespace authorization and isolation", () => {
  it("allows token-authorized read-only join without an account and returns a minimized snapshot", async () => {
    const { token } = await shared();
    const viewer = await connect();
    const result = await join(viewer, token);
    expect(result.success).toBe(true);
    expect(result.data.rideStatus).toBe("accepted");
    expect(result.data.location).toBeNull();
    expect(Object.keys(result.data).sort()).toEqual(
      ["rideStatus", "driver", "vehicle", "location", "trip", "sharing"].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /tokenHash|generation|licenseNumber|email|phone|password|_id|rideId/,
    );
  });
  it.each(["invalid", "malformed", "expired", "revoked"])(
    "rejects %s share access and leaves no share room",
    async (kind) => {
      const { ride, token } = await shared();
      let input = token;
      if (kind === "invalid") input = "A".repeat(43);
      if (kind === "malformed") input = "bad-token";
      if (kind === "expired")
        await RideShare.updateOne({}, { expiresAt: new Date(Date.now() - 1) });
      if (kind === "revoked")
        await api("rider", "delete", `/api/rides/${ride._id}/share`);
      const viewer = await connect();
      const result = await join(viewer, input);
      expect(result.error.status).toBe(404);
      expect(result.error.message).toBe("Shared ride unavailable");
      expect(shareRooms()).toHaveLength(0);
    },
  );
  it("does not permit a ride-A token to select ride B or receive ride-B locations", async () => {
    const a = await shared();
    const b = await secondShare();
    const viewer = await connect();
    expect(
      (await ack(viewer, "share:join", { token: a.token, rideId: b.ride._id }))
        .error.status,
    ).toBe(404);
    expect(
      (await join(viewer, a.token)).data.trip.destination.address,
    ).not.toBe("Second ride destination");
    const received = vi.fn();
    viewer.on("share:location", received);
    await updateTrackedLocation(actors.driver2.user, gps(b.ride._id), 5000);
    await turn();
    expect(received).not.toHaveBeenCalled();
    const valid = event(viewer, "share:location");
    await updateTrackedLocation(actors.driver.user, gps(a.ride._id), 5000);
    await valid;
    expect(received).toHaveBeenCalledTimes(1);
  });
  it("gives a tokenless anonymous connection no location subscription", async () => {
    const { ride } = await shared();
    const viewer = await connect();
    const received = vi.fn();
    viewer.on("share:location", received);
    expect((await ack(viewer, "share:join", {})).error.status).toBe(404);
    await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
    await turn();
    expect(received).not.toHaveBeenCalled();
    expect(shareRooms()).toHaveLength(0);
  });
  it("forbids private room joins and all driver/mutation events on the public namespace", async () => {
    const { ride, token } = await shared();
    const viewer = await connect();
    await join(viewer, token);
    for (const [name, data] of [
      ["ride:join", { rideId: ride._id }],
      ["driver:location:update", gps(ride._id)],
      ["ride:complete", { rideId: ride._id }],
    ])
      expect((await ack(viewer, name, data)).error.status).toBe(403);
    expect(
      runtime.io.of("/").adapter.rooms.get(`ride:${ride._id}`),
    ).toBeUndefined();
    expect((await Ride.findById(ride._id)).status).toBe("accepted");
  });
  it("does not accept a share token as private namespace JWT authentication", async () => {
    const { token } = await shared();
    await expect(connect("", { token })).rejects.toMatchObject({
      message: "Authentication required",
      data: { status: 401 },
    });
  });
  it("rate limits share token guesses per IP", async () => {
    const viewer = await connect();
    let result;
    for (let i = 0; i < 31; i++) result = await join(viewer, "bad-token");
    expect(result.error.status).toBe(429);
    expect(shareRooms()).toHaveLength(0);
  });
});

describe("sanitized public broadcasts and immediate invalidation", () => {
  it("keeps private events private while emitting explicit sanitized public GPS and status DTOs", async () => {
    const { ride, token } = await shared();
    const viewer = await connect();
    await join(viewer, token);
    const rider = await connect("", { token: actors.rider.token });
    await ack(rider, "ride:join", { rideId: ride._id });
    const privateLeak = vi.fn();
    viewer.on("driver:location", privateLeak);
    viewer.on("ride:driver-arriving", privateLeak);
    const publicGps = event(viewer, "share:location");
    const privateGps = event(rider, "driver:location");
    await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
    // The public stream reuses the validated service event. Private delivery still uses its original socket handler.
    const driver = await connect("", { token: actors.driver.token });
    const privateSend = await ack(
      driver,
      "driver:location:update",
      gps(ride._id),
    );
    expect(privateSend.success).toBe(true);
    const publicData = await publicGps;
    expect(Object.keys(publicData).sort()).toEqual([
      "latitude",
      "longitude",
      "updatedAt",
    ]);
    expect(publicData).toMatchObject({ latitude: 51.501, longitude: -0.121 });
    expect((await privateGps).rideId).toBe(ride._id);
    const publicStatus = event(viewer, "share:ride-status");
    const privateStatus = event(rider, "ride:driver-arriving");
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/arriving`)).status,
    ).toBe(200);
    expect(await publicStatus).toMatchObject({ rideStatus: "driver_arriving" });
    expect(Object.keys(await privateStatus)).toContain("rideId");
    expect(privateLeak).not.toHaveBeenCalled();
  });
  it("revokes existing viewers immediately and rejects REST, rejoin and reconnect", async () => {
    const { ride, token } = await shared();
    const viewer = await connect();
    await join(viewer, token);
    const ended = event(viewer, "share:ended");
    expect(
      (await api("rider", "delete", `/api/rides/${ride._id}/share`)).status,
    ).toBe(200);
    expect(await ended).toEqual({ reason: "revoked" });
    expect(shareRooms()).toHaveLength(0);
    const received = vi.fn();
    viewer.on("share:location", received);
    await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
    await turn();
    expect(received).not.toHaveBeenCalled();
    expect((await api(null, "get", `/api/shared-rides/${token}`)).status).toBe(
      404,
    );
    expect((await join(viewer, token)).error.status).toBe(404);
    viewer.disconnect();
    const reconnected = await connect();
    expect((await join(reconnected, token)).error.status).toBe(404);
  });
  it.each(["completed", "cancelled"])(
    "ends connected viewers on %s and blocks reopening",
    async (terminal) => {
      const { ride, token } = await shared();
      const viewer = await connect();
      await join(viewer, token);
      await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
      const ended = event(viewer, "share:ended");
      if (terminal === "completed")
        for (const action of ["arriving", "arrived", "start", "complete"])
          expect(
            (await api("driver", "patch", `/api/rides/${ride._id}/${action}`))
              .status,
          ).toBe(200);
      else
        expect(
          (
            await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
              reason: "Test",
            })
          ).status,
        ).toBe(200);
      expect(await ended).toEqual({ reason: `ride_${terminal}` });
      expect(shareRooms()).toHaveLength(0);
      expect(
        (await api(null, "get", `/api/shared-rides/${token}`)).status,
      ).toBe(404);
      expect((await join(viewer, token)).error.status).toBe(404);
      const reconnect = await connect();
      expect((await join(reconnect, token)).error.status).toBe(404);
      expect((await Ride.findById(ride._id)).trackingLocation).toBeUndefined();
    },
  );
  it("actively expires connected viewers without waiting for TTL deletion or another GPS sample", async () => {
    const { token } = await shared();
    await RideShare.updateOne({}, { expiresAt: new Date(Date.now() + 1500) });
    const viewer = await connect();
    const ended = event(viewer, "share:ended");
    expect((await join(viewer, token)).success).toBe(true);
    expect(await ended).toEqual({ reason: "expired" });
    expect(shareRooms()).toHaveLength(0);
    expect(await RideShare.countDocuments()).toBe(1);
    expect((await join(viewer, token)).error.status).toBe(404);
    expect((await api(null, "get", `/api/shared-rides/${token}`)).status).toBe(
      404,
    );
  });
  it("allows active-token reconnect/rejoin and does not mutate a ride on disconnect", async () => {
    const { ride, token } = await shared();
    const first = await connect();
    await join(first, token);
    first.disconnect();
    const second = await connect();
    expect((await join(second, token)).success).toBe(true);
    expect((await Ride.findById(ride._id)).status).toBe("accepted");
  });
  it("keeps an old revoked generation out when the same share record is replaced", async () => {
    const { ride, token } = await shared();
    const oldViewer = await connect();
    await join(oldViewer, token);
    const ended = event(oldViewer, "share:ended");
    await api("rider", "delete", `/api/rides/${ride._id}/share`);
    await ended;
    const next = await api("rider", "post", `/api/rides/${ride._id}/share`, {});
    expect(next.status).toBe(201);
    const newViewer = await connect();
    expect((await join(newViewer, next.body.data.token)).success).toBe(true);
    expect((await join(oldViewer, token)).error.status).toBe(404);
    const oldLocation = vi.fn();
    oldViewer.on("share:location", oldLocation);
    const fresh = event(newViewer, "share:location");
    await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
    await fresh;
    expect(oldLocation).not.toHaveBeenCalled();
  });
  it("supports explicit public leave and removes its subscription", async () => {
    const { token } = await shared();
    const viewer = await connect();
    await join(viewer, token);
    expect((await ack(viewer, "share:leave", {})).success).toBe(true);
    expect(shareRooms()).toHaveLength(0);
  });
});

it("does not retain a live subscription when join races rider revocation", async () => {
  const { ride, token } = await shared();
  const viewer = await connect();
  const [joined, revoked] = await Promise.all([
    join(viewer, token),
    api("rider", "delete", `/api/rides/${ride._id}/share`),
  ]);
  expect(revoked.status).toBe(200);
  expect(joined.success || joined.error.status === 404).toBe(true);
  expect(shareRooms()).toHaveLength(0);
  const received = vi.fn();
  viewer.on("share:location", received);
  await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
  await turn();
  expect(received).not.toHaveBeenCalled();
});
