import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  rideInput,
  createRide,
  acceptedRide,
  completedRide,
} from "./helpers.js";
import { Ride, DriverProfile, Vehicle, User } from "../src/models/index.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
describe("ride lifecycle and conflicts", () => {
  it("creates a ride with server-side estimate and connected health", async () => {
    const ride = await createRide();
    expect(ride.status).toBe("requested");
    expect(ride.estimatedFare).toBeGreaterThan(0);
    expect((await api(null, "get", "/api/health")).body.database).toBe(
      "connected",
    );
  });
  it("validates creation and rejects supplied fare", async () => {
    expect((await api("rider", "post", "/api/rides", {})).status).toBe(400);
    expect(
      (
        await api("rider", "post", "/api/rides", {
          ...rideInput,
          estimatedFare: 0,
        })
      ).status,
    ).toBe(400);
  });
  it("estimates via API and rejects invalid coordinates", async () => {
    expect(
      (await api("rider", "post", "/api/rides/estimate", rideInput)).status,
    ).toBe(200);
    expect(
      (
        await api("rider", "post", "/api/rides/estimate", {
          ...rideInput,
          pickup: {},
        })
      ).status,
    ).toBe(400);
  });
  it("allows only riders to request rides", async () => {
    expect((await api("driver", "post", "/api/rides", rideInput)).status).toBe(
      403,
    );
  });
  it("allows only one active ride per rider, including concurrent requests", async () => {
    const results = await Promise.all([
      api("rider", "post", "/api/rides", rideInput),
      api("rider", "post", "/api/rides", rideInput),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it("returns own rides before the dynamic ID route", async () => {
    await createRide();
    const r = await api("rider", "get", "/api/rides/me");
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });
  it("validates object IDs and handles missing resources", async () => {
    expect((await api("rider", "get", "/api/rides/not-an-id")).status).toBe(
      400,
    );
    expect(
      (await api("rider", "get", "/api/rides/000000000000000000000001")).status,
    ).toBe(404);
  });
  it("prevents unrelated ride inspection and modification", async () => {
    const ride = await createRide();
    expect((await api("other", "get", `/api/rides/${ride._id}`)).status).toBe(
      403,
    );
    expect(
      (
        await api("other", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "No",
        })
      ).status,
    ).toBe(403);
  });
  it("lists eligible requests for approved online drivers", async () => {
    await createRide();
    const r = await api("driver", "get", "/api/drivers/ride-requests");
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].rider).toBeUndefined();
  });
  it("accepts atomically and marks driver busy", async () => {
    const ride = await acceptedRide();
    expect(ride.status).toBe("accepted");
    expect(ride.driver).toBe(String(actors.driver.user._id));
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("busy");
  });
  it("prevents simultaneous double acceptance and rolls back losing driver", async () => {
    const ride = await createRide();
    const results = await Promise.all(
      ["driver", "driver2"].map((name) =>
        api(name, "patch", `/api/rides/${ride._id}/accept`),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await DriverProfile.countDocuments({ availabilityStatus: "busy" }),
    ).toBe(1);
  });
  it("prevents one driver simultaneously accepting different rides", async () => {
    const first = await createRide();
    const second = await api("other", "post", "/api/rides", rideInput);
    const results = await Promise.all(
      [first._id, second.body.data._id].map((id) =>
        api("driver", "patch", `/api/rides/${id}/accept`),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("rejects riders accepting and unapproved drivers", async () => {
    const ride = await createRide();
    expect(
      (await api("rider", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(403);
    await Vehicle.updateOne(
      { driver: actors.driver.user._id },
      { verificationStatus: "rejected" },
    );
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(403);
  });
  it("blocks incompatible vehicle acceptance", async () => {
    const ride = await createRide();
    await Vehicle.updateOne(
      { driver: actors.driver.user._id },
      { vehicleType: "xl" },
    );
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(409);
  });
  it("rejects skipping states and completion before start", async () => {
    const ride = await acceptedRide();
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/start`)).status,
    ).toBe(409);
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/complete`)).status,
    ).toBe(409);
  });
  it("rejects progress by a different driver", async () => {
    const ride = await acceptedRide();
    expect(
      (await api("driver2", "patch", `/api/rides/${ride._id}/arriving`)).status,
    ).toBe(403);
  });
  it("progresses all states, starts and completes with timestamps and final fare", async () => {
    const ride = await completedRide();
    expect(ride.status).toBe("completed");
    expect(ride.startedAt).toBeInstanceOf(Date);
    expect(ride.completedAt).toBeInstanceOf(Date);
    expect(ride.finalFare).toBe(ride.estimatedFare);
    expect(ride.active).toBe(false);
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("offline");
    expect((await api("rider", "post", "/api/rides", rideInput)).status).toBe(
      201,
    );
  });
  it("prevents busy drivers changing availability or profile", async () => {
    await acceptedRide();
    expect(
      (
        await api("driver", "patch", "/api/drivers/availability", {
          availabilityStatus: "offline",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api("driver", "put", "/api/drivers/profile", {
          licenseNumber: "CHANGED",
        })
      ).status,
    ).toBe(409);
  });
  it("allows rider cancellation before acceptance and a fresh request", async () => {
    const ride = await createRide();
    const r = await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
      reason: "Plans changed",
    });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("cancelled");
    expect((await api("rider", "post", "/api/rides", rideInput)).status).toBe(
      201,
    );
  });
  it("allows assigned driver cancellation and frees driver", async () => {
    const ride = await acceptedRide();
    expect(
      (
        await api("driver", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "Vehicle issue",
        })
      ).status,
    ).toBe(200);
    expect(
      (await DriverProfile.findById(actors.driver.profile._id))
        .availabilityStatus,
    ).toBe("offline");
  });
  it("blocks cancellation after start and after completion", async () => {
    const ride = await acceptedRide();
    for (const action of ["arriving", "arrived", "start"])
      expect(
        (await api("driver", "patch", `/api/rides/${ride._id}/${action}`))
          .status,
      ).toBe(200);
    expect(
      (
        await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "No",
        })
      ).status,
    ).toBe(409);
    await api("driver", "patch", `/api/rides/${ride._id}/complete`);
    expect(
      (
        await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
          reason: "No",
        })
      ).status,
    ).toBe(409);
  });
});

describe("concurrent administrative and onboarding changes", () => {
  it("serializes profile edits against acceptance", async () => {
    const ride = await createRide();
    const results = await Promise.all([
      api("driver", "patch", `/api/rides/${ride._id}/accept`),
      api("driver", "put", "/api/drivers/profile", { licenseNumber: "EDITED" }),
    ]);
    expect([200, 403, 409]).toContain(results[0].status);
    expect([200, 409]).toContain(results[1].status);
    const current = await Ride.findById(ride._id);
    const profile = await DriverProfile.findById(actors.driver.profile._id);
    if (current.status === "accepted") {
      expect(profile.verificationStatus).toBe("approved");
      expect(profile.availabilityStatus).toBe("busy");
    } else {
      expect(profile.verificationStatus).toBe("pending");
      expect(profile.availabilityStatus).toBe("offline");
    }
  });
  it("serializes vehicle edits against acceptance", async () => {
    const ride = await createRide();
    const { vehicleInput } = await import("./helpers.js");
    const results = await Promise.all([
      api("driver", "patch", `/api/rides/${ride._id}/accept`),
      api("driver", "put", "/api/drivers/vehicle", vehicleInput),
    ]);
    expect([200, 403, 409]).toContain(results[0].status);
    expect([200, 409]).toContain(results[1].status);
    const current = await Ride.findById(ride._id);
    const vehicle = await Vehicle.findById(actors.driver.vehicle._id);
    if (current.status === "accepted")
      expect(vehicle.verificationStatus).toBe("approved");
    else expect(vehicle.verificationStatus).toBe("pending");
  });
  it("serializes driver suspension against acceptance", async () => {
    const ride = await createRide();
    const results = await Promise.all([
      api("driver", "patch", `/api/rides/${ride._id}/accept`),
      api(
        "admin",
        "patch",
        `/api/admin/users/${actors.driver.user._id}/active`,
        { isActive: false },
      ),
    ]);
    expect([200, 401, 403, 409]).toContain(results[0].status);
    expect([200, 409]).toContain(results[1].status);
    const current = await Ride.findById(ride._id);
    const user = await User.findById(actors.driver.user._id);
    expect(current.status === "accepted" && !user.isActive).toBe(false);
  });
  it("serializes rider suspension against ride creation", async () => {
    const results = await Promise.all([
      api("rider", "post", "/api/rides", rideInput),
      api(
        "admin",
        "patch",
        `/api/admin/users/${actors.rider.user._id}/active`,
        { isActive: false },
      ),
    ]);
    expect([201, 401]).toContain(results[0].status);
    expect([200, 409]).toContain(results[1].status);
    const user = await User.findById(actors.rider.user._id);
    const ride = await Ride.findOne({ rider: user._id, active: true });
    expect(Boolean(ride) && !user.isActive).toBe(false);
  });
});
