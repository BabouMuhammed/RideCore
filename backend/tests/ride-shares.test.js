import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createHash } from "node:crypto";
import request from "supertest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  app,
  secret,
  createRide,
  acceptedRide,
  completedRide,
} from "./helpers.js";
import { Ride, RideShare } from "../src/models/index.js";
import { updateTrackedLocation } from "../src/services/tracking.js";
import { createApp } from "../src/app.js";
import { readFeatureSettings } from "../src/config/features.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
const create = (id) => api("rider", "post", `/api/rides/${id}/share`, {});
const snapshot = (token) => api(null, "get", `/api/shared-rides/${token}`);
async function shared() {
  const ride = await acceptedRide();
  const response = await create(ride._id);
  expect(response.status).toBe(201);
  return { ride, ...response.body.data };
}
const gps = (id) => ({
  rideId: String(id),
  latitude: 51.501,
  longitude: -0.121,
  heading: 120,
  speed: 8,
});
function assertMinimized(data) {
  expect(Object.keys(data).sort()).toEqual(
    ["rideStatus", "driver", "vehicle", "location", "trip", "sharing"].sort(),
  );
  expect(Object.keys(data.driver).sort()).toEqual(["firstName", "rating"]);
  expect(Object.keys(data.vehicle).sort()).toEqual(
    ["make", "model", "color", "plateNumber"].sort(),
  );
  const forbidden = new Set([
    "_id",
    "__v",
    "rideId",
    "riderId",
    "driverId",
    "profileId",
    "email",
    "phone",
    "password",
    "token",
    "tokenHash",
    "generation",
    "licenseNumber",
    "payments",
    "payment",
    "otp",
    "isActive",
    "verificationStatus",
  ]);
  function inspect(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      expect(forbidden.has(key)).toBe(false);
      inspect(nested);
    }
  }
  inspect(data);
}
describe("share creation and storage", () => {
  it("issues a 256-bit token once, stores only its hash and returns a domain-independent path", async () => {
    const { ride, token, sharePath, expiresAt } = await shared();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(sharePath).toBe(`/track/${token}`);
    expect(new Date(expiresAt).getTime() - Date.now()).toBeGreaterThan(
      14390000,
    );
    const stored = await RideShare.findOne({ ride: ride._id }).select(
      "+tokenHash +generation",
    );
    expect(stored.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(JSON.stringify(stored.toObject())).not.toContain(token);
    expect(stored.toObject()).not.toHaveProperty("token");
    expect(stored.toJSON()).not.toHaveProperty("tokenHash");
    expect(stored.toJSON()).not.toHaveProperty("generation");
    expect((await RideShare.findById(stored._id)).tokenHash).toBeUndefined();
    const repeat = await create(ride._id);
    expect(repeat.status).toBe(409);
    expect(repeat.body.data).toBeUndefined();
  });
  it.each(["other", "driver", "driver2", "admin", null])(
    "rejects creation by %s",
    async (name) => {
      const ride = await acceptedRide();
      const response = await api(
        name,
        "post",
        `/api/rides/${ride._id}/share`,
        {},
      );
      expect(response.status).toBe(name ? 403 : 401);
      expect(await RideShare.countDocuments()).toBe(0);
    },
  );
  it("supports all four assigned trackable states", async () => {
    const ride = await acceptedRide();
    for (const action of [null, "arriving", "arrived", "start"]) {
      if (action)
        expect(
          (await api("driver", "patch", `/api/rides/${ride._id}/${action}`))
            .status,
        ).toBe(200);
      expect((await create(ride._id)).status).toBe(201);
      expect(
        (await api("rider", "delete", `/api/rides/${ride._id}/share`)).status,
      ).toBe(200);
    }
  });
  it("rejects an unassigned requested ride", async () => {
    const ride = await createRide();
    expect((await create(ride._id)).status).toBe(409);
  });
  it.each(["completed", "cancelled"])(
    "rejects creation on %s rides",
    async (status) => {
      const ride =
        status === "completed" ? await completedRide() : await acceptedRide();
      if (status === "cancelled")
        await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "Test",
        });
      expect((await create(ride._id)).status).toBe(409);
    },
  );
  it("accepts a bodyless request and rejects client-selected secrets or expiry", async () => {
    const ride = await acceptedRide();
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/share`, {
          expiresAt: "2100-01-01",
          token: "predictable",
        })
      ).status,
    ).toBe(400);
    expect(
      (await api("rider", "post", `/api/rides/${ride._id}/share`)).status,
    ).toBe(201);
  });
  it("applies configured expiry and sensitive-response headers", async () => {
    const ride = await acceptedRide();
    const local = createApp({
      jwtSecret: secret,
      logging: false,
      features: { ...readFeatureSettings({}), RIDE_SHARE_TTL_SECONDS: 60 },
    });
    const response = await request(local)
      .post(`/api/rides/${ride._id}/share`)
      .set("Authorization", `Bearer ${actors.rider.token}`)
      .send({});
    expect(response.status).toBe(201);
    expect(
      new Date(response.body.data.expiresAt).getTime() - Date.now(),
    ).toBeLessThanOrEqual(60000);
    const read = await request(local).get(
      `/api/shared-rides/${response.body.data.token}`,
    );
    for (const result of [response, read]) {
      expect(result.headers["cache-control"]).toBe("no-store");
      expect(result.headers["referrer-policy"]).toBe("no-referrer");
      expect(result.headers["x-robots-tag"]).toBe("noindex, nofollow");
    }
  });
});
describe("public snapshot authorization and location privacy", () => {
  it("returns only an explicit safe DTO and no general driver GPS before a ride-specific update", async () => {
    const { ride, token } = await shared();
    await api("driver", "patch", "/api/drivers/location", {
      type: "Point",
      coordinates: [40, -20],
    });
    const before = await snapshot(token);
    expect(before.status).toBe(200);
    expect(before.body.data.location).toBeNull();
    assertMinimized(before.body.data);
    await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
    const after = await snapshot(token);
    expect(after.status).toBe(200);
    assertMinimized(after.body.data);
    expect(after.body.data.location).toMatchObject({
      latitude: 51.501,
      longitude: -0.121,
    });
    expect(Object.keys(after.body.data.location).sort()).toEqual([
      "latitude",
      "longitude",
      "updatedAt",
    ]);
    expect(after.body.data.trip.pickup).toEqual({
      address: "Pickup",
      latitude: 51.5,
      longitude: -0.12,
    });
  });
  it.each(["random", "malformed", "rideId", "userId", "hash", "altered"])(
    "rejects %s credentials uniformly",
    async (kind) => {
      const { ride, token } = await shared();
      const values = {
        random: "A".repeat(43),
        malformed: "bad-token",
        rideId: ride._id,
        userId: String(actors.rider.user._id),
        hash: createHash("sha256").update(token).digest("hex"),
        altered: (token[0] === "A" ? "B" : "A") + token.slice(1),
      };
      const response = await snapshot(values[kind]);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: { message: "Shared ride unavailable" },
      });
    },
  );
  it("rejects expiry independently of MongoDB TTL cleanup", async () => {
    const { token } = await shared();
    await RideShare.updateOne({}, { expiresAt: new Date(Date.now() - 1) });
    expect(await RideShare.countDocuments()).toBe(1);
    expect((await snapshot(token)).status).toBe(404);
  });
  it.each(["completed", "cancelled"])(
    "checks %s ride eligibility even if share metadata is stale",
    async (status) => {
      const { ride, token } = await shared();
      await Ride.updateOne({ _id: ride._id }, { status, active: false });
      expect((await RideShare.findOne({})).status).toBe("active");
      expect((await snapshot(token)).status).toBe(404);
    },
  );
  it("does not leak tokens in malformed URL errors or expose a location history route", async () => {
    const { token } = await shared();
    const malformed = await snapshot(`${token}%E0%A4%A`);
    expect(malformed.status).toBe(404);
    expect(JSON.stringify(malformed.body)).not.toContain(token);
    expect(
      (await api(null, "get", `/api/shared-rides/${token}/history`)).status,
    ).toBe(404);
  });
  it("does not leak token material through normal ride or admin responses", async () => {
    const { ride, token } = await shared();
    const stored = await RideShare.findOne({}).select("+tokenHash +generation");
    for (const [name, path] of [
      ["rider", `/api/rides/${ride._id}`],
      ["admin", "/api/admin/rides"],
      ["admin", "/api/admin/users"],
      ["admin", "/api/admin/drivers"],
      ["admin", "/api/admin/payments"],
    ]) {
      const response = await api(name, "get", path);
      expect(response.status).toBe(200);
      const text = JSON.stringify(response.body);
      expect(text).not.toContain(token);
      expect(text).not.toContain(stored.tokenHash);
      expect(text).not.toContain(stored.generation);
    }
  });
  it("rate limits public requests without requiring authentication", async () => {
    const { token } = await shared();
    const local = createApp({
      jwtSecret: secret,
      logging: false,
      features: { ...readFeatureSettings({}), RIDE_SHARE_RATE_LIMIT_MAX: 3 },
    });
    for (let i = 0; i < 3; i++)
      expect(
        (await request(local).get(`/api/shared-rides/${token}`)).status,
      ).toBe(200);
    const limited = await request(local).get(`/api/shared-rides/${token}`);
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Too many shared ride requests");
  });
});
describe("revocation, lifecycle and concurrency", () => {
  it("revokes immediately and permits explicit replacement without reviving the old token", async () => {
    const { ride, token } = await shared();
    expect(
      (await api("rider", "delete", `/api/rides/${ride._id}/share`)).body.data
        .revoked,
    ).toBe(true);
    expect((await snapshot(token)).status).toBe(404);
    expect((await RideShare.findOne({})).status).toBe("revoked");
    const replacement = await create(ride._id);
    expect(replacement.status).toBe(201);
    expect(replacement.body.data.token).not.toBe(token);
    expect((await snapshot(token)).status).toBe(404);
    expect((await snapshot(replacement.body.data.token)).status).toBe(200);
    expect(await RideShare.countDocuments()).toBe(1);
  });
  it.each(["other", "driver", "driver2", "admin", null])(
    "prevents revocation by %s",
    async (name) => {
      const { ride, token } = await shared();
      expect(
        (await api(name, "delete", `/api/rides/${ride._id}/share`)).status,
      ).toBe(name ? 403 : 401);
      expect((await snapshot(token)).status).toBe(200);
    },
  );
  it("makes owning-rider revocation idempotent", async () => {
    const ride = await acceptedRide();
    for (let i = 0; i < 2; i++)
      expect(
        (await api("rider", "delete", `/api/rides/${ride._id}/share`)).body
          .data,
      ).toEqual({ revoked: true });
  });
  it("allows replacement of an expired link before TTL deletion", async () => {
    const { ride, token } = await shared();
    await RideShare.updateOne({}, { expiresAt: new Date(Date.now() - 1) });
    const next = await create(ride._id);
    expect(next.status).toBe(201);
    expect((await snapshot(token)).status).toBe(404);
    expect((await snapshot(next.body.data.token)).status).toBe(200);
  });
  it("serializes simultaneous creation into one active link", async () => {
    const ride = await acceptedRide();
    const results = await Promise.all([create(ride._id), create(ride._id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await RideShare.countDocuments({ ride: ride._id, status: "active" }),
    ).toBe(1);
    expect(
      (await snapshot(results.find((r) => r.status === 201).body.data.token))
        .status,
    ).toBe(200);
  });
  it("serializes replacement against revocation with one unambiguous valid token", async () => {
    const { ride, token } = await shared();
    const [created, revoked] = await Promise.all([
      create(ride._id),
      api("rider", "delete", `/api/rides/${ride._id}/share`),
    ]);
    expect([201, 409]).toContain(created.status);
    expect(revoked.status).toBe(200);
    expect((await snapshot(token)).status).toBe(404);
    expect(await RideShare.countDocuments()).toBe(1);
    if (created.status === 201)
      expect((await snapshot(created.body.data.token)).status).toBe(200);
    else expect(await RideShare.countDocuments({ status: "active" })).toBe(0);
  });
  it.each(["completed", "cancelled"])(
    "invalidates sharing and clears ride GPS atomically on %s",
    async (status) => {
      const { ride, token } = await shared();
      await updateTrackedLocation(actors.driver.user, gps(ride._id), 5000);
      if (status === "completed")
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
      expect((await snapshot(token)).status).toBe(404);
      const share = await RideShare.findOne({});
      expect(share.status).toBe("ended");
      expect(share.endReason).toBe(`ride_${status}`);
      expect((await Ride.findById(ride._id)).trackingLocation).toBeUndefined();
    },
  );
  it("prevents a create/completion race from leaving usable sharing", async () => {
    const ride = await acceptedRide();
    for (const action of ["arriving", "arrived", "start"])
      await api("driver", "patch", `/api/rides/${ride._id}/${action}`);
    const [created, completed] = await Promise.all([
      create(ride._id),
      api("driver", "patch", `/api/rides/${ride._id}/complete`),
    ]);
    expect([201, 409]).toContain(created.status);
    expect(completed.status).toBe(200);
    expect(await RideShare.countDocuments({ status: "active" })).toBe(0);
    if (created.status === 201)
      expect((await snapshot(created.body.data.token)).status).toBe(404);
  });
});

it("cannot follow a driver into a later journey with the old ride token", async () => {
  const { ride, token } = await shared();
  for (const action of ["arriving", "arrived", "start", "complete"])
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/${action}`)).status,
    ).toBe(200);
  expect(
    (
      await api("driver", "patch", "/api/drivers/availability", {
        availabilityStatus: "online",
      })
    ).status,
  ).toBe(200);
  const next = await api("other", "post", "/api/rides", {
    pickup: {
      address: "Next pickup",
      location: { type: "Point", coordinates: [-0.12, 51.5] },
    },
    destination: {
      address: "Next destination",
      location: { type: "Point", coordinates: [-0.11, 51.51] },
    },
    vehicleType: "economy",
  });
  expect(next.status).toBe(201);
  expect(
    (await api("driver", "patch", `/api/rides/${next.body.data._id}/accept`))
      .status,
  ).toBe(200);
  await updateTrackedLocation(
    actors.driver.user,
    { ...gps(next.body.data._id), latitude: 51.509, longitude: -0.109 },
    5000,
  );
  expect((await snapshot(token)).status).toBe(404);
  expect((await Ride.findById(ride._id)).trackingLocation).toBeUndefined();
});
