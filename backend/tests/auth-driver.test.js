import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
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
  location,
  vehicleInput,
} from "./helpers.js";
import { User, DriverProfile, Vehicle } from "../src/models/index.js";
import { createApp } from "../src/app.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
describe("authentication", () => {
  it("registers a normalized rider and hashes the password", async () => {
    const r = await api(null, "post", "/api/auth/register", {
      ...registration,
      email: " New@Example.Test ",
      phone: "+44 (7700) 900099",
    });
    expect(r.status).toBe(201);
    expect(r.body.data.email).toBe("new@example.test");
    expect(r.body.data.phone).toBe("+447700900099");
    expect(r.body.data.password).toBeUndefined();
    const user = await User.findById(r.body.data._id).select("+password");
    expect(user.password).not.toBe(password);
  });
  it("creates a pending profile with driver registration", async () => {
    const r = await api(null, "post", "/api/auth/register", {
      ...registration,
      email: "newdriver@example.test",
      phone: "+447700900099",
      role: "driver",
    });
    expect(r.status).toBe(201);
    expect(
      (await DriverProfile.findOne({ user: r.body.data._id }))
        .verificationStatus,
    ).toBe("pending");
  });
  it("rejects duplicate email", async () => {
    const r = await api(null, "post", "/api/auth/register", registration);
    expect(r.status).toBe(409);
  });
  it("rejects duplicate phone", async () => {
    const r = await api(null, "post", "/api/auth/register", {
      ...registration,
      email: "unique@example.test",
      phone: actors.rider.user.phone,
    });
    expect(r.status).toBe(409);
  });
  it("forbids self-registration as admin and unknown fields", async () => {
    expect(
      (
        await api(null, "post", "/api/auth/register", {
          ...registration,
          role: "admin",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api(null, "post", "/api/auth/register", {
          ...registration,
          isActive: true,
        })
      ).status,
    ).toBe(400);
  });
  it("logs in and accesses own profile without exposing hashes", async () => {
    const r = await api(null, "post", "/api/auth/login", {
      email: "RIDER@example.test",
      password,
    });
    expect(r.status).toBe(200);
    expect(r.body.data.user.password).toBeUndefined();
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${r.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.password).toBeUndefined();
  });
  it.each(["rider@example.test", "unknown@example.test"])(
    "uses generic failure for %s",
    async (email) => {
      const r = await api(null, "post", "/api/auth/login", {
        email,
        password: "wrong-password",
      });
      expect(r.status).toBe(401);
      expect(r.body.error.message).toBe("Invalid email or password");
    },
  );
  it("rejects missing and invalid tokens", async () => {
    expect((await api(null, "get", "/api/auth/me")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/auth/me")
          .set("Authorization", "Bearer invalid")
      ).status,
    ).toBe(401);
  });
  it("rejects inactive users even with previously issued JWT", async () => {
    await User.updateOne({ _id: actors.rider.user._id }, { isActive: false });
    expect((await api("rider", "get", "/api/auth/me")).status).toBe(401);
  });
  it("limits authentication attempts", async () => {
    const isolated = createApp({ jwtSecret: "x".repeat(32), logging: false });
    let r;
    for (let i = 0; i < 31; i++)
      r = await request(isolated).post("/api/auth/login").send({});
    expect(r.status).toBe(429);
  });
});
describe("driver onboarding and location", () => {
  it("returns the driver profile and vehicle", async () => {
    const r = await api("driver", "get", "/api/drivers/me");
    expect(r.status).toBe(200);
    expect(r.body.data.profile.user).toBe(String(actors.driver.user._id));
  });
  it("resets approval and goes offline when profile changes", async () => {
    const r = await api("driver", "put", "/api/drivers/profile", {
      licenseNumber: "new-license",
    });
    expect(r.status).toBe(200);
    expect(r.body.data.verificationStatus).toBe("pending");
    expect(r.body.data.availabilityStatus).toBe("offline");
  });
  it("resets vehicle approval after vehicle edits", async () => {
    const r = await api("driver", "put", "/api/drivers/vehicle", vehicleInput);
    expect(r.status).toBe(200);
    expect(r.body.data.verificationStatus).toBe("pending");
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("offline");
  });
  it("updates GeoJSON longitude first", async () => {
    const r = await api("driver", "patch", "/api/drivers/location", location);
    expect(r.status).toBe(200);
    expect(r.body.data.currentLocation.coordinates).toEqual([-0.12, 51.5]);
  });
  it.each([[181, 0], [0, 91], [1], ["1", 2]])(
    "rejects coordinates %j",
    async (...coordinates) => {
      const r = await api("driver", "patch", "/api/drivers/location", {
        type: "Point",
        coordinates,
      });
      expect(r.status).toBe(400);
    },
  );
  it("allows online/offline and blocks client-selected busy status", async () => {
    expect(
      (
        await api("driver", "patch", "/api/drivers/availability", {
          availabilityStatus: "offline",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("driver", "patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("driver", "patch", "/api/drivers/availability", {
          availabilityStatus: "busy",
        })
      ).status,
    ).toBe(400);
  });
  it("requires approved driver and vehicle before going online", async () => {
    await Vehicle.updateOne(
      { driver: actors.driver.user._id },
      { verificationStatus: "pending" },
    );
    expect(
      (
        await api("driver", "patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(403);
  });
  it("requires a location before going online", async () => {
    await DriverProfile.updateOne(
      { user: actors.driver.user._id },
      { $unset: { currentLocation: 1 } },
    );
    expect(
      (
        await api("driver", "patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(409);
  });
  it("prevents riders and unauthenticated users updating drivers", async () => {
    expect(
      (await api("rider", "patch", "/api/drivers/location", location)).status,
    ).toBe(403);
    expect(
      (await api(null, "patch", "/api/drivers/location", location)).status,
    ).toBe(401);
  });
});
