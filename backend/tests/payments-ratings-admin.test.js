import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  createRide,
  acceptedRide,
  completedRide,
} from "./helpers.js";
import {
  DriverProfile,
  Payment,
  Rating,
  User,
  Vehicle,
} from "../src/models/index.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
describe("simulated payments", () => {
  it.each(["cash", "mock_wallet"])(
    "records %s payment from a legitimate completed ride",
    async (method) => {
      const ride = await completedRide();
      const r = await api("rider", "post", `/api/rides/${ride._id}/payment`, {
        method,
      });
      expect(r.status).toBe(200);
      expect(r.body.data.amount).toBe(ride.finalFare);
      expect(r.body.data.status).toBe("paid");
      expect(r.body.data.transactionReference).toMatch(/^SIM-/);
    },
  );
  it("is idempotent under concurrent duplicate payment calls", async () => {
    const ride = await completedRide();
    const results = await Promise.all(
      [1, 2].map(() =>
        api("rider", "post", `/api/rides/${ride._id}/payment`, {
          method: "mock_wallet",
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0].body.data._id).toBe(results[1].body.data._id);
    expect(await Payment.countDocuments()).toBe(1);
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/payment`, {
          method: "cash",
        })
      ).status,
    ).toBe(409);
  });
  it("rejects payment for unfinished or missing ride", async () => {
    const ride = await createRide();
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/payment`, {
          method: "cash",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api(
          "rider",
          "post",
          "/api/rides/000000000000000000000001/payment",
          { method: "cash" },
        )
      ).status,
    ).toBe(404);
  });
  it("rejects unrelated users and drivers paying a ride", async () => {
    const ride = await completedRide();
    for (const name of ["other", "driver"])
      expect(
        (
          await api(name, "post", `/api/rides/${ride._id}/payment`, {
            method: "cash",
          })
        ).status,
      ).toBe(403);
  });
  it("exposes payment only to participants or admin", async () => {
    const ride = await completedRide();
    await api("rider", "post", `/api/rides/${ride._id}/payment`, {
      method: "cash",
    });
    expect(
      (await api("driver", "get", `/api/rides/${ride._id}/payment`)).status,
    ).toBe(200);
    expect(
      (await api("other", "get", `/api/rides/${ride._id}/payment`)).status,
    ).toBe(403);
  });
  it("rejects real card payloads and invalid methods", async () => {
    const ride = await completedRide();
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/payment`, {
          method: "card",
          cardNumber: "123",
        })
      ).status,
    ).toBe(400);
  });
});
describe("ratings", () => {
  it("allows both participants to rate the other and updates driver average", async () => {
    const ride = await completedRide();
    const r = await api("rider", "post", `/api/rides/${ride._id}/ratings`, {
      rating: 4,
      comment: "Good ride",
    });
    expect(r.status).toBe(201);
    expect(r.body.data.reviewee).toBe(String(actors.driver.user._id));
    expect(
      (
        await api("driver", "post", `/api/rides/${ride._id}/ratings`, {
          rating: 5,
        })
      ).status,
    ).toBe(201);
    const driver = await DriverProfile.findById(actors.driver.profile._id);
    expect(driver.ratingAverage).toBe(4);
    expect(driver.ratingCount).toBe(1);
  });
  it("rejects ratings before completion", async () => {
    const ride = await acceptedRide();
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/ratings`, {
          rating: 5,
        })
      ).status,
    ).toBe(409);
  });
  it("rejects duplicate concurrent ratings without double-counting", async () => {
    const ride = await completedRide();
    const results = await Promise.all(
      [1, 2].map(() =>
        api("rider", "post", `/api/rides/${ride._id}/ratings`, { rating: 5 }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Rating.countDocuments()).toBe(1);
    expect(
      (await DriverProfile.findById(actors.driver.profile._id)).ratingCount,
    ).toBe(1);
  });
  it("rejects unrelated users and out-of-range ratings", async () => {
    const ride = await completedRide();
    expect(
      (
        await api("other", "post", `/api/rides/${ride._id}/ratings`, {
          rating: 5,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api("rider", "post", `/api/rides/${ride._id}/ratings`, {
          rating: 6,
        })
      ).status,
    ).toBe(400);
  });
});
describe("admin and API security", () => {
  it("requires authentication and admin role for all admin resources", async () => {
    for (const path of ["users", "drivers", "rides", "payments"]) {
      expect((await api(null, "get", `/api/admin/${path}`)).status).toBe(401);
      expect((await api("rider", "get", `/api/admin/${path}`)).status).toBe(
        403,
      );
      expect((await api("admin", "get", `/api/admin/${path}`)).status).toBe(
        200,
      );
    }
  });
  it("approves and rejects driver profiles", async () => {
    const path = `/api/admin/drivers/${actors.driver.profile._id}/verification`;
    expect(
      (await api("admin", "patch", path, { verificationStatus: "rejected" }))
        .status,
    ).toBe(200);
    const r = await api("admin", "patch", path, {
      verificationStatus: "approved",
    });
    expect(r.status).toBe(200);
    expect(r.body.data.verificationStatus).toBe("approved");
  });
  it("rejects driver approval without license information", async () => {
    await DriverProfile.updateOne(
      { _id: actors.driver.profile._id },
      { $unset: { licenseNumber: 1 } },
    );
    expect(
      (
        await api(
          "admin",
          "patch",
          `/api/admin/drivers/${actors.driver.profile._id}/verification`,
          { verificationStatus: "approved" },
        )
      ).status,
    ).toBe(409);
  });
  it("approves and rejects vehicles", async () => {
    const path = `/api/admin/vehicles/${actors.driver.vehicle._id}/verification`;
    expect(
      (await api("admin", "patch", path, { verificationStatus: "rejected" }))
        .status,
    ).toBe(200);
    expect(
      (await api("admin", "patch", path, { verificationStatus: "approved" }))
        .status,
    ).toBe(200);
  });
  it("blocks non-admin verification updates", async () => {
    expect(
      (
        await api(
          "driver",
          "patch",
          `/api/admin/vehicles/${actors.driver.vehicle._id}/verification`,
          { verificationStatus: "approved" },
        )
      ).status,
    ).toBe(403);
  });
  it("suspends and reactivates a user and invalidates existing access", async () => {
    const path = `/api/admin/users/${actors.driver.user._id}/active`;
    expect(
      (await api("admin", "patch", path, { isActive: false })).status,
    ).toBe(200);
    expect((await api("driver", "get", "/api/auth/me")).status).toBe(401);
    expect((await api("admin", "patch", path, { isActive: true })).status).toBe(
      200,
    );
    expect((await api("driver", "get", "/api/auth/me")).status).toBe(200);
  });
  it("protects self-suspension and changes during active rides", async () => {
    expect(
      (
        await api(
          "admin",
          "patch",
          `/api/admin/users/${actors.admin.user._id}/active`,
          { isActive: false },
        )
      ).status,
    ).toBe(409);
    await acceptedRide();
    expect(
      (
        await api(
          "admin",
          "patch",
          `/api/admin/users/${actors.driver.user._id}/active`,
          { isActive: false },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api(
          "admin",
          "patch",
          `/api/admin/vehicles/${actors.driver.vehicle._id}/verification`,
          { verificationStatus: "rejected" },
        )
      ).status,
    ).toBe(409);
  });
  it("does not expose hashes in admin lists", async () => {
    const r = await api("admin", "get", "/api/admin/users");
    expect(r.body.data.every((user) => user.password === undefined)).toBe(true);
  });
  it("rejects malformed JSON and oversized bodies consistently", async () => {
    const request = (await import("supertest")).default;
    const { app } = await import("./helpers.js");
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    const r = await request(app)
      .post("/api/auth/login")
      .send({ data: "x".repeat(40000) });
    expect(r.status).toBe(413);
    expect(r.body.success).toBe(false);
  });
});

it("computes driver average safely from concurrent ratings on different rides", async () => {
  const first = await completedRide();
  await api("driver", "patch", "/api/drivers/availability", {
    availabilityStatus: "online",
  });
  const second = await completedRide();
  const results = await Promise.all([
    api("rider", "post", `/api/rides/${first._id}/ratings`, { rating: 4 }),
    api("rider", "post", `/api/rides/${second._id}/ratings`, { rating: 2 }),
  ]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  const profile = await DriverProfile.findById(actors.driver.profile._id);
  expect(profile.ratingAverage).toBe(3);
  expect(profile.ratingCount).toBe(2);
});
