import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  app,
  registration,
  password,
  vehicleInput,
  location,
  rideInput,
  completedRide,
} from "./helpers.js";
import { User, DriverProfile, Vehicle, Ride } from "../src/models/index.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
const overview = async () =>
  (await api("admin", "get", "/api/admin/overview")).body.data;

describe("administrator overview and human-operated workflow", () => {
  it("requires an active administrator on the new overview route", async () => {
    expect((await api(null, "get", "/api/admin/overview")).status).toBe(401);
    for (const role of ["rider", "driver"])
      expect((await api(role, "get", "/api/admin/overview")).status).toBe(403);
    expect(await overview()).toEqual({
      registeredRiders: 2,
      registeredDrivers: 2,
      pendingDriverApprovals: 0,
      onlineDrivers: 2,
      activeRides: 0,
      completedRides: 0,
      cancelledRides: 0,
      recordedPayments: 0,
    });
    await User.updateOne({ _id: actors.admin.user._id }, { isActive: false });
    expect((await api("admin", "get", "/api/admin/overview")).status).toBe(401);
  });
  it("counts globally beyond a page and counts completed/cancelled rides and actual payment records", async () => {
    const seed = await User.findById(actors.rider.user._id).select("+password");
    await User.insertMany(
      Array.from({ length: 55 }, (_, index) => ({
        firstName: "Isolated",
        lastName: `Rider ${index}`,
        email: `isolated-${index}@example.test`,
        phone: `+2206${String(index).padStart(6, "0")}`,
        password: seed.password,
        role: "rider",
        isActive: index % 2 === 0,
      })),
    );
    const completed = await completedRide();
    expect(
      (
        await api("rider", "post", `/api/rides/${completed._id}/payment`, {
          method: "cash",
        })
      ).status,
    ).toBe(200);
    const ride = (await api("rider", "post", "/api/rides", rideInput)).body
      .data;
    await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
      reason: "Isolated cancellation",
    });
    expect(await overview()).toMatchObject({
      registeredRiders: 57,
      registeredDrivers: 2,
      activeRides: 0,
      completedRides: 1,
      cancelledRides: 1,
      recordedPayments: 1,
    });
    const first = await api("admin", "get", "/api/admin/users?page=1");
    const second = await api("admin", "get", "/api/admin/users?page=2");
    expect(first.body.data).toHaveLength(50);
    expect(second.body.data).toHaveLength(10);
    expect(first.body.data.every((row) => !row.password)).toBe(true);
  });
  it("counts only eligible online drivers and real pending driver profiles", async () => {
    await Vehicle.updateOne(
      { driver: actors.driver.user._id },
      { verificationStatus: "pending" },
    );
    expect((await overview()).onlineDrivers).toBe(1);
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { verificationStatus: "pending" },
    );
    expect(await overview()).toMatchObject({
      onlineDrivers: 0,
      pendingDriverApprovals: 1,
    });
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { verificationStatus: "approved" },
    );
    await User.updateOne({ _id: actors.driver2.user._id }, { isActive: false });
    expect((await overview()).onlineDrivers).toBe(0);
    await User.updateOne({ _id: actors.driver2.user._id }, { isActive: true });
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { $unset: { currentLocation: 1 } },
    );
    expect((await overview()).onlineDrivers).toBe(0);
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { currentLocation: location, availabilityStatus: "busy" },
    );
    expect((await overview()).onlineDrivers).toBe(0);
    await DriverProfile.updateOne(
      { user: actors.driver2.user._id },
      { availabilityStatus: "online" },
    );
    // Defensive exclusion even if an inconsistent record still says online.
    await Ride.create({
      rider: actors.rider.user._id,
      driver: actors.driver2.user._id,
      pickup: rideInput.pickup,
      destination: rideInput.destination,
      status: "accepted",
      active: true,
    });
    expect((await overview()).onlineDrivers).toBe(0);
  });
  it("logs in a real admin, approves a newly registered driver and vehicle, matches a ride and manages accounts", async () => {
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.test", password });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.data.token;
    const admin = (method, path, body) =>
      request(app)
        [method](path)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(body);
    const driverInput = {
      ...registration,
      email: "new-driver@example.test",
      phone: "+2207000123",
      accountType: "driver",
    };
    expect(
      (await request(app).post("/api/auth/register").send(driverInput)).status,
    ).toBe(201);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: driverInput.email, password });
    const token = login.body.data.token;
    const driver = (method, path, body) =>
      request(app)
        [method](path)
        .set("Authorization", `Bearer ${token}`)
        .send(body);
    const profile = await driver("put", "/api/drivers/profile", {
      licenseNumber: "ISOLATED-NEW",
    });
    const vehicle = await driver("put", "/api/drivers/vehicle", {
      ...vehicleInput,
      plateNumber: "ISOLATED-NEW",
    });
    const p = profile.body.data._id,
      v = vehicle.body.data._id;
    await driver("patch", "/api/drivers/location", location);
    expect(
      (
        await driver("patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await admin("patch", `/api/admin/drivers/${p}/verification`, {
          verificationStatus: "approved",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await driver("patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await admin("patch", `/api/admin/vehicles/${v}/verification`, {
          verificationStatus: "approved",
        })
      ).status,
    ).toBe(200);
    expect(
      (await driver("get", "/api/drivers/me")).body.data.profile
        .availabilityStatus,
    ).toBe("offline");
    expect(
      (
        await driver("patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(200);
    const nearby = await api(
      "rider",
      "get",
      "/api/drivers/nearby?lat=51.5&lng=-0.12",
    );
    const identity = (await driver("get", "/api/auth/me")).body.data;
    expect(nearby.body.data.some((row) => row.driverId === identity._id)).toBe(
      true,
    );
    const ride = (await api("rider", "post", "/api/rides", rideInput)).body
      .data;
    expect(
      (await driver("get", "/api/drivers/ride-requests")).body.data.some(
        (row) => row._id === ride._id,
      ),
    ).toBe(true);
    expect(
      (await driver("patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(200);
    expect(
      (await admin("get", `/api/rides/${ride._id}`)).body.data.driverDetails
        .firstName,
    ).toBe(driverInput.firstName);
    expect(
      (
        await admin("patch", `/api/admin/users/${identity._id}/active`, {
          isActive: false,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await admin("patch", `/api/admin/drivers/${p}/verification`, {
          verificationStatus: "suspended",
        })
      ).status,
    ).toBe(409);
    for (const action of ["arriving", "arrived", "start", "complete"])
      expect(
        (await driver("patch", `/api/rides/${ride._id}/${action}`)).status,
      ).toBe(200);
    expect(
      (
        await admin("patch", `/api/admin/drivers/${p}/verification`, {
          verificationStatus: "suspended",
        })
      ).status,
    ).toBe(200);
    expect(
      (await driver("get", "/api/drivers/me")).body.data.profile
        .verificationStatus,
    ).toBe("suspended");
    expect(
      (
        await driver("patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(403);
    for (const active of [false, true]) {
      expect(
        (
          await admin("patch", `/api/admin/users/${identity._id}/active`, {
            isActive: active,
          })
        ).status,
      ).toBe(200);
      expect((await driver("get", "/api/auth/me")).status).toBe(
        active ? 200 : 401,
      );
    }
    expect(
      (await driver("get", "/api/drivers/me")).body.data.profile
        .availabilityStatus,
    ).toBe("offline");
    expect((await admin("get", "/api/admin/rides")).body.data).toHaveLength(1);
  });
});
