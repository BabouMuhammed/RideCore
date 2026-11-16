import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { io as connectClient } from "socket.io-client";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  secret,
  createRide,
  acceptedRide,
  completedRide,
} from "./helpers.js";
import { createHttpServer } from "../src/http-server.js";
import { User, DriverProfile, Ride } from "../src/models/index.js";
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
function open(auth) {
  const socket = connectClient(url, {
    auth,
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false,
    timeout: 3000,
  });
  clients.push(socket);
  return socket;
}
async function connected(name, extra = {}) {
  const socket = open({ token: actors[name].token, ...extra });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });
  return socket;
}
const ack = (socket, event, body) =>
  socket.timeout(5000).emitWithAck(event, body);
const join = (socket, rideId) => ack(socket, "ride:join", { rideId });
function event(socket, name, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const listener = (data) => {
      clearTimeout(timer);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(name, listener);
      reject(new Error(`Missing ${name} event`));
    }, timeoutMs);
    socket.once(name, listener);
  });
}
const tracking = (rideId) => ({
  rideId: String(rideId),
  latitude: 51.501,
  longitude: -0.121,
  heading: 120,
  speed: 8,
});

describe("shared HTTP server and socket authentication", () => {
  it("serves REST and authenticated Socket.IO on the same HTTP server", async () => {
    expect((await request(runtime.server).get("/api/health")).status).toBe(200);
    expect(runtime.io.httpServer).toBe(runtime.server);
    expect((await connected("rider")).connected).toBe(true);
  });
  it.each(["missing", "malformed", "expired", "inactive"])(
    "rejects %s authentication",
    async (kind) => {
      let auth = {};
      if (kind === "malformed") auth.token = "not-a-jwt";
      if (kind === "expired")
        auth.token = jwt.sign({}, secret, {
          subject: String(actors.rider.user._id),
          issuer: "ride-core",
          audience: "ride-core-api",
          expiresIn: -1,
        });
      if (kind === "inactive") {
        await User.updateOne(
          { _id: actors.rider.user._id },
          { isActive: false },
        );
        auth.token = actors.rider.token;
      }
      const socket = open(auth);
      const error = event(socket, "connect_error");
      socket.connect();
      const failure = await error;
      expect(failure.message).toBe("Authentication required");
      expect(failure.data.status).toBe(401);
      expect(socket.connected).toBe(false);
    },
  );
  it("rechecks account activation for an already connected socket", async () => {
    const socket = await connected("rider");
    await User.updateOne({ _id: actors.rider.user._id }, { isActive: false });
    const result = await join(socket, "000000000000000000000001");
    expect(result.error.status).toBe(401);
  });
  it("disconnects an already connected socket when its JWT expires", async () => {
    const token = jwt.sign({}, secret, {
      subject: String(actors.rider.user._id),
      issuer: "ride-core",
      audience: "ride-core-api",
      expiresIn: "2s",
    });
    const socket = await connected("rider", { token });
    const reason = await event(socket, "disconnect", 4000);
    expect(reason).toBe("io server disconnect");
    expect(socket.connected).toBe(false);
  });
});

describe("ride room authorization and reconnects", () => {
  it("allows rider and assigned driver to join their ride, including uppercase IDs", async () => {
    const ride = await acceptedRide();
    const rider = await connected("rider");
    const driver = await connected("driver");
    expect((await join(rider, ride._id.toUpperCase())).success).toBe(true);
    expect((await join(driver, ride._id)).success).toBe(true);
    const room = runtime.io.sockets.adapter.rooms.get(`ride:${ride._id}`);
    expect(room.has(rider.id)).toBe(true);
    expect(room.has(driver.id)).toBe(true);
  });
  it("rejects unrelated users, unassigned drivers and non-participating admins", async () => {
    const ride = await acceptedRide();
    for (const name of ["other", "driver2", "admin"]) {
      const socket = await connected(name);
      const result = await join(socket, ride._id);
      expect(result.error.status).toBe(403);
    }
    expect(
      runtime.io.sockets.adapter.rooms.get(`ride:${ride._id}`),
    ).toBeUndefined();
  });
  it("rejects malformed and missing ride IDs", async () => {
    const socket = await connected("rider");
    expect((await join(socket, "bad-id")).error.status).toBe(400);
    expect((await join(socket, "000000000000000000000001")).error.status).toBe(
      404,
    );
  });
  it("supports explicit room leave", async () => {
    const ride = await acceptedRide();
    const socket = await connected("rider");
    await join(socket, ride._id);
    expect(
      (await ack(socket, "ride:leave", { rideId: ride._id })).success,
    ).toBe(true);
    expect(
      runtime.io.sockets.adapter.rooms.get(`ride:${ride._id}`),
    ).toBeUndefined();
  });
  it("preserves ride and driver state on disconnect and permits reconnect/rejoin", async () => {
    const ride = await acceptedRide();
    const first = await connected("driver");
    await join(first, ride._id);
    first.disconnect();
    const second = await connected("driver");
    expect((await join(second, ride._id)).success).toBe(true);
    expect((await Ride.findById(ride._id)).status).toBe("accepted");
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("busy");
  });
});

describe("tracking authorization, validation and persistence", () => {
  it.each(["location", "ride-state"])(
    "revokes a disabled passive subscriber before %s disclosure",
    async (kind) => {
      const ride = await acceptedRide();
      const rider = await connected("rider");
      const driver = await connected("driver");
      await join(rider, ride._id);
      await join(driver, ride._id);
      const received = [];
      rider.onAny((name) => received.push(name));
      await User.updateOne({ _id: actors.rider.user._id }, { isActive: false });
      const disconnected = event(rider, "disconnect");
      if (kind === "location") {
        expect(
          (await ack(driver, "driver:location:update", tracking(ride._id)))
            .success,
        ).toBe(true);
      } else {
        const allowed = event(driver, "ride:driver-arriving");
        expect(
          (await api("driver", "patch", `/api/rides/${ride._id}/arriving`))
            .status,
        ).toBe(200);
        await allowed;
      }
      expect(await disconnected).toBe("io server disconnect");
      expect(received).toEqual([]);
    },
  );

  it("denies a demoted driver's existing socket token without changing location", async () => {
    const ride = await acceptedRide();
    const driver = await connected("driver");
    await join(driver, ride._id);
    await User.updateOne({ _id: actors.driver.user._id }, { role: "rider" });
    const beforeRide = await Ride.findById(ride._id).lean();
    const beforeProfile = await DriverProfile.findById(
      actors.driver.profile._id,
    ).lean();
    const result = await ack(
      driver,
      "driver:location:update",
      tracking(ride._id),
    );
    expect(result.error.status).toBe(403);
    expect(await Ride.findById(ride._id).lean()).toEqual(beforeRide);
    expect(
      await DriverProfile.findById(actors.driver.profile._id).lean(),
    ).toEqual(beforeProfile);
  });

  it("broadcasts sanitized assigned-driver locations only to the authorized ride room", async () => {
    const ride = await acceptedRide();
    const rider = await connected("rider");
    const driver = await connected("driver");
    const other = await connected("other");
    await join(rider, ride._id);
    expect((await join(other, ride._id)).error.status).toBe(403);
    const broadcast = event(rider, "driver:location");
    const result = await ack(
      driver,
      "driver:location:update",
      tracking(ride._id),
    );
    expect(result.success).toBe(true);
    const payload = await broadcast;
    expect(payload).toMatchObject(tracking(ride._id));
    expect(Object.keys(payload).sort()).toEqual(
      [
        "rideId",
        "latitude",
        "longitude",
        "heading",
        "speed",
        "timestamp",
      ].sort(),
    );
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(
      (await DriverProfile.findById(actors.driver.profile._id)).currentLocation
        .coordinates,
    ).toEqual([-0.121, 51.501]);
    expect(
      runtime.io.sockets.adapter.rooms.get(`ride:${ride._id}`).has(other.id),
    ).toBe(false);
  });
  it("throttles persistence while allowing fresher broadcasts across reconnects", async () => {
    const ride = await acceptedRide();
    const rider = await connected("rider");
    let driver = await connected("driver");
    await join(rider, ride._id);
    expect(
      (await ack(driver, "driver:location:update", tracking(ride._id))).success,
    ).toBe(true);
    const first = await DriverProfile.findById(actors.driver.profile._id);
    driver.disconnect();
    driver = await connected("driver");
    const next = { ...tracking(ride._id), longitude: -0.122 };
    const received = event(rider, "driver:location");
    expect((await ack(driver, "driver:location:update", next)).success).toBe(
      true,
    );
    expect((await received).longitude).toBe(-0.122);
    const second = await DriverProfile.findById(actors.driver.profile._id);
    expect(second.currentLocation.coordinates).toEqual(
      first.currentLocation.coordinates,
    );
    expect(second.locationPersistedAt).toEqual(first.locationPersistedAt);
    await DriverProfile.updateOne(
      { _id: first._id },
      { locationPersistedAt: new Date(Date.now() - 6000) },
    );
    expect((await ack(driver, "driver:location:update", next)).success).toBe(
      true,
    );
    expect(
      (await DriverProfile.findById(first._id)).currentLocation.coordinates[0],
    ).toBe(-0.122);
  });
  it("rejects unrelated drivers and ignores spoofed handshake identity", async () => {
    const ride = await acceptedRide();
    const unrelated = await connected("driver2");
    expect(
      (await ack(unrelated, "driver:location:update", tracking(ride._id))).error
        .status,
    ).toBe(403);
    const rider = await connected("rider", {
      role: "driver",
      userId: String(actors.driver.user._id),
    });
    expect(
      (await ack(rider, "driver:location:update", tracking(ride._id))).error
        .status,
    ).toBe(403);
  });
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { latitude: "51" },
    { heading: 360 },
    { speed: -1 },
    { speed: 101 },
    { rideId: "bad-id" },
    { userId: "spoofed" },
  ])("rejects invalid tracking payload %j", async (invalid) => {
    const ride = await acceptedRide();
    const socket = await connected("driver");
    const result = await ack(socket, "driver:location:update", {
      ...tracking(ride._id),
      ...invalid,
    });
    expect(result.error.status).toBe(400);
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .locationPersistedAt,
    ).toBeUndefined();
  });
  it.each(["completed", "cancelled"])(
    "rejects tracking and rejoin for %s rides",
    async (status) => {
      const ride =
        status === "completed" ? await completedRide() : await acceptedRide();
      if (status === "cancelled")
        await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "Test",
        });
      const socket = await connected("driver");
      expect(
        (await ack(socket, "driver:location:update", tracking(ride._id))).error
          .status,
      ).toBe(409);
      expect((await join(socket, String(ride._id))).error.status).toBe(409);
    },
  );
  it("enforces account-scoped socket event limits", async () => {
    const socket = await connected("rider");
    const results = await Promise.all(
      Array.from({ length: 25 }, () => join(socket, "bad-id")),
    );
    expect(results.some((r) => r.error.status === 429)).toBe(true);
    expect(results.every((r) => [400, 429].includes(r.error.status))).toBe(
      true,
    );
  });
});

describe("authoritative REST ride-state notifications", () => {
  it("delivers every committed lifecycle event and removes the terminal room", async () => {
    const ride = await createRide();
    const rider = await connected("rider");
    expect((await join(rider, ride._id)).success).toBe(true);
    for (const [action, name, status] of [
      ["accept", "ride:accepted", "accepted"],
      ["arriving", "ride:driver-arriving", "driver_arriving"],
      ["arrived", "ride:driver-arrived", "driver_arrived"],
      ["start", "ride:started", "in_progress"],
      ["complete", "ride:completed", "completed"],
    ]) {
      const received = event(rider, name);
      const response = await request(runtime.server)
        .patch(`/api/rides/${ride._id}/${action}`)
        .set("Authorization", `Bearer ${actors.driver.token}`);
      expect(response.status).toBe(200);
      const payload = await received;
      expect(payload).toMatchObject({ rideId: ride._id, status });
      expect(Object.keys(payload).sort()).toEqual([
        "rideId",
        "status",
        "timestamp",
      ]);
    }
    expect(
      runtime.io.sockets.adapter.rooms.get(`ride:${ride._id}`),
    ).toBeUndefined();
  });
  it("delivers cancellation and denies late subscriptions", async () => {
    const ride = await createRide();
    const rider = await connected("rider");
    await join(rider, ride._id);
    const received = event(rider, "ride:cancelled");
    expect(
      (
        await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "Changed plans",
        })
      ).status,
    ).toBe(200);
    expect((await received).status).toBe("cancelled");
    expect((await join(rider, ride._id)).error.status).toBe(409);
  });
});
