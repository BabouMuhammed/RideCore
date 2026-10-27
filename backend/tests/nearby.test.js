import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  createRide,
  acceptedRide,
  location,
} from "./helpers.js";
import { DriverProfile, User, Vehicle } from "../src/models/index.js";
import { nearbyDrivers } from "../src/services/nearby.js";
import { createApp } from "../src/app.js";
import { readFeatureSettings } from "../src/config/features.js";
import { secret } from "./helpers.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
const preview = () =>
  api("rider", "get", "/api/drivers/nearby?lat=51.5&lng=-0.12");
describe("nearby-driver discovery", () => {
  it("returns eligible nearby drivers ordered by distance with safe map fields", async () => {
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { currentLocation: { type: "Point", coordinates: [-0.12, 51.52] } },
    );
    const response = await preview();
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    const [first, second] = response.body.data;
    expect(first.driverId).toBe(String(actors.driver.user._id));
    expect(first.distanceKm).toBeLessThan(second.distanceKm);
    expect(Object.keys(first).sort()).toEqual(
      [
        "driverId",
        "profileId",
        "location",
        "vehicle",
        "ratingAverage",
        "ratingCount",
        "distanceKm",
      ].sort(),
    );
    expect(Object.keys(first.vehicle).sort()).toEqual([
      "make",
      "model",
      "vehicleType",
    ]);
    const serialized = JSON.stringify(response.body);
    for (const field of [
      "email",
      "phone",
      "licenseNumber",
      "password",
      "plateNumber",
      "isActive",
      "isVerified",
    ])
      expect(serialized).not.toContain(`"${field}"`);
    expect(first.location.coordinates).toEqual(location.coordinates);
  });
  it("excludes drivers more than 50 km away", async () => {
    await DriverProfile.updateOne(
      { user: actors.driver.user._id },
      { currentLocation: { type: "Point", coordinates: [-0.12, 52] } },
    );
    const result = await preview();
    expect(result.body.data.map((d) => d.driverId)).not.toContain(
      String(actors.driver.user._id),
    );
  });
  it.each(["offline", "busy"])(
    "excludes %s drivers",
    async (availabilityStatus) => {
      await DriverProfile.updateOne(
        { user: actors.driver.user._id },
        { availabilityStatus },
      );
      expect((await preview()).body.data.map((d) => d.driverId)).not.toContain(
        String(actors.driver.user._id),
      );
    },
  );
  it.each(["pending", "rejected", "suspended"])(
    "excludes %s driver profiles",
    async (verificationStatus) => {
      await DriverProfile.updateOne(
        { user: actors.driver.user._id },
        { verificationStatus },
      );
      expect((await preview()).body.data.map((d) => d.driverId)).not.toContain(
        String(actors.driver.user._id),
      );
    },
  );
  it("excludes inactive accounts, wrong account roles and unapproved vehicles", async () => {
    await User.updateOne({ _id: actors.driver.user._id }, { isActive: false });
    await Vehicle.updateOne(
      { driver: actors.driver2.user._id },
      { verificationStatus: "pending" },
    );
    expect((await preview()).body.data).toEqual([]);
    await User.updateOne(
      { _id: actors.driver.user._id },
      { isActive: true, role: "rider" },
    );
    expect((await preview()).body.data).toEqual([]);
  });
  it("excludes a driver without a current location", async () => {
    await DriverProfile.updateOne(
      { user: actors.driver.user._id },
      { $unset: { currentLocation: 1 } },
    );
    expect((await preview()).body.data.map((d) => d.driverId)).not.toContain(
      String(actors.driver.user._id),
    );
  });
  it("excludes active ride assignments even if availability is inconsistent", async () => {
    await acceptedRide();
    await DriverProfile.updateOne(
      { user: actors.driver.user._id },
      { availabilityStatus: "online" },
    );
    expect((await preview()).body.data.map((d) => d.driverId)).not.toContain(
      String(actors.driver.user._id),
    );
    expect(
      (await api("driver", "get", "/api/drivers/ride-requests")).status,
    ).toBe(409);
  });
  it("respects a configured smaller radius in both preview and request discovery", async () => {
    await DriverProfile.updateOne(
      { user: actors.driver.user._id },
      { currentLocation: { type: "Point", coordinates: [-0.12, 51.55] } },
    );
    expect(
      (await nearbyDrivers(location.coordinates, 10)).map((d) =>
        String(d.driverId),
      ),
    ).toContain(String(actors.driver.user._id));
    expect(
      (await nearbyDrivers(location.coordinates, 1)).map((d) =>
        String(d.driverId),
      ),
    ).not.toContain(String(actors.driver.user._id));
    await createRide();
    const local = createApp({
      jwtSecret: secret,
      features: { ...readFeatureSettings({}), DRIVER_SEARCH_RADIUS_KM: 1 },
      logging: false,
    });
    const response = await request(local)
      .get("/api/drivers/ride-requests")
      .set("Authorization", `Bearer ${actors.driver.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
  it.each([
    "lat=91&lng=0",
    "lat=0&lng=-181",
    "lat=NaN&lng=0",
    "lat=&lng=0",
    "lat=0",
    "lat=0&lat=1&lng=0",
  ])("rejects invalid query %s", async (query) => {
    expect(
      (await api("rider", "get", `/api/drivers/nearby?${query}`)).status,
    ).toBe(400);
  });
  it("requires rider authentication", async () => {
    expect(
      (await api(null, "get", "/api/drivers/nearby?lat=51.5&lng=-0.12")).status,
    ).toBe(401);
    expect(
      (await api("driver", "get", "/api/drivers/nearby?lat=51.5&lng=-0.12"))
        .status,
    ).toBe(403);
  });
  it("validates coordinates at the service boundary", async () => {
    await expect(nearbyDrivers([181, 0], 10)).rejects.toThrow(
      "Invalid search coordinates",
    );
    await expect(nearbyDrivers(location.coordinates, -1)).rejects.toThrow(
      "Invalid search radius",
    );
  });
});
describe("ride request proximity", () => {
  it("shows the pickup to nearby drivers but excludes distant drivers and rejects distant acceptance", async () => {
    const ride = await createRide();
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { currentLocation: { type: "Point", coordinates: [-0.12, 52] } },
    );
    expect(
      (await api("driver", "get", "/api/drivers/ride-requests")).body.data[0]
        ._id,
    ).toBe(ride._id);
    expect(
      (await api("driver2", "get", "/api/drivers/ride-requests")).body.data,
    ).toEqual([]);
    expect(
      (await api("driver2", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(409);
    expect(
      (await DriverProfile.findById(actors.driver2.profile._id))
        .availabilityStatus,
    ).toBe("online");
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(200);
  });
  it("does not show requests for the wrong vehicle type", async () => {
    await createRide();
    await Vehicle.updateOne(
      { driver: actors.driver.user._id },
      { vehicleType: "xl" },
    );
    expect(
      (await api("driver", "get", "/api/drivers/ride-requests")).body.data,
    ).toEqual([]);
  });
});

it("uses matching spherical radius units for discovery and atomic acceptance at the boundary", async () => {
  const ride = await createRide();
  const latitude = 51.5 + ((1.0005 / 6378.1) * 180) / Math.PI;
  await DriverProfile.updateOne(
    { user: actors.driver.user._id },
    { currentLocation: { type: "Point", coordinates: [-0.12, latitude] } },
  );
  const local = createApp({
    jwtSecret: secret,
    features: { ...readFeatureSettings({}), DRIVER_SEARCH_RADIUS_KM: 1 },
    logging: false,
  });
  const nearby = await request(local)
    .get("/api/drivers/nearby?lat=51.5&lng=-0.12")
    .set("Authorization", `Bearer ${actors.rider.token}`);
  expect(nearby.status).toBe(200);
  expect(nearby.body.data.map((driver) => driver.driverId)).not.toContain(
    String(actors.driver.user._id),
  );
  const accepted = await request(local)
    .patch(`/api/rides/${ride._id}/accept`)
    .set("Authorization", `Bearer ${actors.driver.token}`);
  expect(accepted.status).toBe(409);
  expect(
    (await DriverProfile.findById(actors.driver.profile._id))
      .availabilityStatus,
  ).toBe("online");
});
