import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  app,
  secret,
  password,
  registration,
  location,
  vehicleInput,
  rideInput,
  createRide,
  acceptedRide,
  completedRide,
} from "./helpers.js";
import {
  User,
  DriverProfile,
  Vehicle,
  Ride,
  Payment,
  Rating,
} from "../src/models/index.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);

describe("audit regressions", () => {
  it("rejects admin self-suspension with an uppercase ObjectId", async () => {
    const id = String(actors.admin.user._id).toUpperCase();
    const response = await api(
      "admin",
      "patch",
      `/api/admin/users/${id}/active`,
      { isActive: false },
    );
    expect(response.status).toBe(409);
    expect((await User.findById(id)).isActive).toBe(true);
  });
  it("treats a JWT with a malformed subject as invalid authentication", async () => {
    const token = jwt.sign({}, secret, {
      subject: "not-an-object-id",
      issuer: "ride-core",
      audience: "ride-core-api",
      expiresIn: "1h",
    });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Authentication required");
  });
});

describe("JWT trust boundaries", () => {
  it.each([
    ["expired", { expiresIn: -1 }, secret],
    ["not active yet", { notBefore: "1h" }, secret],
    ["wrong issuer", { issuer: "another-service" }, secret],
    ["wrong audience", { audience: "another-client" }, secret],
    ["wrong algorithm", { algorithm: "HS384" }, secret],
    ["wrong signature", {}, "different-test-only-signing-secret"],
    ["unknown account", { subject: "000000000000000000000001" }, secret],
  ])("rejects %s JWT", async (name, overrides, key) => {
    const token = jwt.sign({}, key, {
      subject: String(actors.rider.user._id),
      issuer: "ride-core",
      audience: "ride-core-api",
      expiresIn: "1h",
      ...overrides,
    });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: { message: "Authentication required" },
    });
  });
  it("rejects a signed JWT with no subject", async () => {
    const token = jwt.sign({}, secret, {
      issuer: "ride-core",
      audience: "ride-core-api",
      expiresIn: "1h",
    });
    expect(
      (
        await request(app)
          .get("/api/auth/me")
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(401);
  });
});

describe("public registration through completed ride end-to-end", () => {
  it("onboards both roles, logs in admin, approves, rides, pays idempotently and rates", async () => {
    for (const [name, role, phone] of [
      ["demoRider", "rider", "+447700901001"],
      ["demoDriver", "driver", "+447700901002"],
    ]) {
      const email = `${name.toLowerCase()}@example.test`;
      const registered = await api(null, "post", "/api/auth/register", {
        ...registration,
        email,
        phone,
        accountType: role,
      });
      expect(registered.status).toBe(201);
      expect(registered.body.data).toMatchObject({ role, isActive: true });
      expect(registered.body.data.password).toBeUndefined();
      const loggedIn = await api(null, "post", "/api/auth/login", {
        email,
        password,
      });
      expect(loggedIn.status).toBe(200);
      actors[name] = { token: loggedIn.body.data.token };
      const me = await api(name, "get", "/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.data._id).toBe(registered.body.data._id);
    }
    const admin = await api(null, "post", "/api/auth/login", {
      email: "admin@example.test",
      password,
    });
    expect(admin.status).toBe(200);
    actors.demoAdmin = { token: admin.body.data.token };
    const profile = await api("demoDriver", "put", "/api/drivers/profile", {
      licenseNumber: "DEMO-AUDIT-LICENSE",
    });
    expect(profile.status).toBe(200);
    expect(profile.body.data.verificationStatus).toBe("pending");
    const vehicle = await api("demoDriver", "put", "/api/drivers/vehicle", {
      ...vehicleInput,
      plateNumber: "AUDIT-001",
    });
    expect(vehicle.status).toBe(200);
    expect(vehicle.body.data.verificationStatus).toBe("pending");
    expect(
      (
        await api("demoDriver", "patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(403);
    for (const [kind, id] of [
      ["drivers", profile.body.data._id],
      ["vehicles", vehicle.body.data._id],
    ]) {
      const approved = await api(
        "demoAdmin",
        "patch",
        `/api/admin/${kind}/${id}/verification`,
        { verificationStatus: "approved" },
      );
      expect(approved.status).toBe(200);
      expect(approved.body.data.verificationStatus).toBe("approved");
    }
    expect(
      (await api("demoDriver", "patch", "/api/drivers/location", location))
        .status,
    ).toBe(200);
    expect(
      (
        await api("demoDriver", "patch", "/api/drivers/availability", {
          availabilityStatus: "online",
        })
      ).status,
    ).toBe(200);
    const moved = await api("demoDriver", "patch", "/api/drivers/location", {
      type: "Point",
      coordinates: [-0.121, 51.501],
    });
    expect(moved.status).toBe(200);
    expect(moved.body.data.availabilityStatus).toBe("online");
    const estimate = await api(
      "demoRider",
      "post",
      "/api/rides/estimate",
      rideInput,
    );
    expect(estimate.status).toBe(200);
    expect(estimate.body.data.distanceMethod).toBe("haversine_straight_line");
    const created = await api("demoRider", "post", "/api/rides", rideInput);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("requested");
    const id = created.body.data._id;
    expect(created.body.data.estimatedFare).toBe(
      estimate.body.data.estimatedFare,
    );
    const requests = await api(
      "demoDriver",
      "get",
      "/api/drivers/ride-requests",
    );
    expect(requests.status).toBe(200);
    expect(requests.body.data.some((r) => r._id === id)).toBe(true);
    const states = [
      ["accept", "accepted"],
      ["arriving", "driver_arriving"],
      ["arrived", "driver_arrived"],
      ["start", "in_progress"],
      ["complete", "completed"],
    ];
    for (const [action, status] of states) {
      const response = await api(
        "demoDriver",
        "patch",
        `/api/rides/${id}/${action}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(status);
    }
    const finished = await api("demoRider", "get", `/api/rides/${id}`);
    expect(finished.body.data.active).toBe(false);
    for (const field of [
      "requestedAt",
      "acceptedAt",
      "arrivingAt",
      "arrivedAt",
      "startedAt",
      "completedAt",
    ])
      expect(Number.isNaN(Date.parse(finished.body.data[field]))).toBe(false);
    const first = await api("demoRider", "post", `/api/rides/${id}/payment`, {
      method: "mock_wallet",
    });
    const second = await api("demoRider", "post", `/api/rides/${id}/payment`, {
      method: "mock_wallet",
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data._id).toBe(first.body.data._id);
    expect(first.body.data).toMatchObject({
      amount: finished.body.data.finalFare,
      status: "paid",
      method: "mock_wallet",
    });
    expect(await Payment.countDocuments({ ride: id })).toBe(1);
    const rating = await api("demoRider", "post", `/api/rides/${id}/ratings`, {
      rating: 5,
      comment: "Verified end-to-end",
    });
    expect(rating.status).toBe(201);
    const driver = await api("demoDriver", "get", "/api/drivers/me");
    expect(driver.body.data.profile).toMatchObject({
      ratingAverage: 5,
      ratingCount: 1,
      availabilityStatus: "offline",
    });
  });
});

describe("eligibility, rollback and terminal invariants", () => {
  it.each(["pending", "rejected", "suspended"])(
    "blocks %s driver from going online or accepting",
    async (status) => {
      await DriverProfile.updateOne(
        { _id: actors.driver.profile._id },
        { verificationStatus: status },
      );
      expect(
        (
          await api("driver", "patch", "/api/drivers/availability", {
            availabilityStatus: "online",
          })
        ).status,
      ).toBe(403);
      const ride = await createRide();
      expect(
        (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
      ).toBe(403);
      expect((await Ride.findById(ride._id)).status).toBe("requested");
    },
  );
  it("blocks acceptance and discovery while offline", async () => {
    await api("driver", "patch", "/api/drivers/availability", {
      availabilityStatus: "offline",
    });
    const ride = await createRide();
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(409);
    expect(
      (await api("driver", "get", "/api/drivers/ride-requests")).status,
    ).toBe(409);
  });
  it("blocks a busy driver accepting another ride without changing either ride", async () => {
    const first = await acceptedRide();
    const other = await api("other", "post", "/api/rides", rideInput);
    expect(other.status).toBe(201);
    expect(
      (await api("driver", "patch", `/api/rides/${other.body.data._id}/accept`))
        .status,
    ).toBe(409);
    expect((await Ride.findById(first._id)).status).toBe("accepted");
    expect((await Ride.findById(other.body.data._id)).status).toBe("requested");
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("busy");
  });
  it("rolls back vehicle/profile changes when a duplicate plate conflicts", async () => {
    const response = await api("driver", "put", "/api/drivers/vehicle", {
      ...vehicleInput,
      plateNumber: actors.driver2.vehicle.plateNumber,
    });
    expect(response.status).toBe(409);
    const profile = await DriverProfile.findById(actors.driver.profile._id);
    const vehicle = await Vehicle.findById(actors.driver.vehicle._id);
    expect(profile.availabilityStatus).toBe("online");
    expect(vehicle.plateNumber).toBe(actors.driver.vehicle.plateNumber);
    expect(vehicle.verificationStatus).toBe("approved");
  });
  it("rolls back driver/profile changes when a duplicate license conflicts", async () => {
    expect(
      (
        await api("driver", "put", "/api/drivers/profile", {
          licenseNumber: actors.driver2.profile.licenseNumber,
        })
      ).status,
    ).toBe(409);
    const profile = await DriverProfile.findById(actors.driver.profile._id);
    expect(profile.licenseNumber).toBe(actors.driver.profile.licenseNumber);
    expect(profile.verificationStatus).toBe("approved");
    expect(profile.availabilityStatus).toBe("online");
  });
  it("keeps completed rides terminal and prevents repeated completion effects", async () => {
    const ride = await completedRide();
    for (const action of ["accept", "arriving", "arrived", "start", "complete"])
      expect(
        (await api("driver", "patch", `/api/rides/${ride._id}/${action}`))
          .status,
      ).toBe(409);
    const unchanged = await Ride.findById(ride._id);
    expect(unchanged.completedAt).toEqual(ride.completedAt);
    expect(unchanged.finalFare).toBe(ride.finalFare);
  });
  it("rejects payment and rating for a cancelled ride", async () => {
    const ride = await acceptedRide();
    expect(
      (
        await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "Cancelled",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/payment`, {
          method: "cash",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/ratings`, {
          rating: 5,
        })
      ).status,
    ).toBe(409);
    expect(await Payment.countDocuments()).toBe(0);
    expect(await Rating.countDocuments()).toBe(0);
  });
  it("allows admin cancellation before start and releases the assigned driver", async () => {
    const ride = await acceptedRide();
    const response = await api(
      "admin",
      "patch",
      `/api/rides/${ride._id}/cancel`,
      { reason: "Admin intervention" },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("cancelled");
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("offline");
  });
  it("serializes vehicle rejection against going online", async () => {
    await api("driver", "patch", "/api/drivers/availability", {
      availabilityStatus: "offline",
    });
    const results = await Promise.all([
      api("driver", "patch", "/api/drivers/availability", {
        availabilityStatus: "online",
      }),
      api(
        "admin",
        "patch",
        `/api/admin/vehicles/${actors.driver.vehicle._id}/verification`,
        { verificationStatus: "rejected" },
      ),
    ]);
    expect(results[1].status).toBe(200);
    expect([200, 403]).toContain(results[0].status);
    const profile = await DriverProfile.findById(actors.driver.profile._id);
    expect(profile.availabilityStatus).toBe("offline");
    expect(
      (await Vehicle.findById(actors.driver.vehicle._id)).verificationStatus,
    ).toBe("rejected");
  });
});

describe("additional role and vehicle boundaries", () => {
  it("rejects anonymous ride requests and driver access to admin inspection", async () => {
    expect((await api(null, "post", "/api/rides", rideInput)).status).toBe(401);
    expect((await api("driver", "get", "/api/admin/users")).status).toBe(403);
  });
  it.each(["pending", "rejected", "suspended"])(
    "blocks a %s vehicle from going online or accepting",
    async (status) => {
      await Vehicle.updateOne(
        { _id: actors.driver.vehicle._id },
        { verificationStatus: status },
      );
      expect(
        (
          await api("driver", "patch", "/api/drivers/availability", {
            availabilityStatus: "online",
          })
        ).status,
      ).toBe(403);
      const ride = await createRide();
      expect(
        (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
      ).toBe(403);
    },
  );
  it("validates malformed IDs on admin mutations and ride payment", async () => {
    expect(
      (
        await api("admin", "patch", "/api/admin/users/invalid/active", {
          isActive: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("rider", "post", "/api/rides/invalid/payment", {
          method: "cash",
        })
      ).status,
    ).toBe(400);
  });
});

describe("sensitive input boundaries", () => {
  it("rejects weak and over-72-byte UTF-8 passwords before persistence", async () => {
    const count = await User.countDocuments();
    for (const invalidPassword of ["short", "\u00e9".repeat(40)]) {
      const response = await api(null, "post", "/api/auth/register", {
        ...registration,
        email: "password-boundary@example.test",
        phone: "+447700902001",
        password: invalidPassword,
      });
      expect(response.status).toBe(400);
    }
    expect(await User.countDocuments()).toBe(count);
  });
  it("rejects client-selected payment amounts and rating targets", async () => {
    const ride = await completedRide();
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/payment`, {
          method: "cash",
          amount: 0,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/ratings`, {
          rating: 5,
          reviewee: String(actors.other.user._id),
        })
      ).status,
    ).toBe(400);
    expect(await Payment.countDocuments()).toBe(0);
    expect(await Rating.countDocuments()).toBe(0);
  });
});
