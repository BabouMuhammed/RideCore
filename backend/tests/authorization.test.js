import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  app,
  secret,
  registration,
  vehicleInput,
  completedRide,
} from "./helpers.js";
import {
  models,
  User,
  DriverProfile,
  Vehicle,
  Payment,
} from "../src/models/index.js";
import * as auth from "../src/services/auth.js";
import * as drivers from "../src/services/drivers.js";

// Real HTTP + Mongoose integration against helpers' disposable MongoDB replica set.
// No persistence, authentication or domain services are mocked.
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);

async function snapshot() {
  return Promise.all(
    models.map((model) =>
      model.find().select("+password").sort({ _id: 1 }).lean(),
    ),
  );
}

const privilegedFields = [
  { role: "admin" },
  { role: "driver" },
  { admin: true },
  { isAdmin: true },
  { permissions: ["admin"] },
  { walletBalance: 99999 },
  { balance: 99999 },
  { isActive: true },
  { isVerified: true },
  { phoneVerifiedAt: new Date().toISOString() },
  { $set: { role: "admin" } },
];

describe("role management policy", () => {
  it.each([null, "rider", "driver", "admin"])(
    "%s cannot use any HTTP promotion/demotion route, for self or another user",
    async (actor) => {
      const before = await snapshot();
      for (const route of ["become-admin", "become-staff", "fire-staff"])
        for (const target of [
          actors[actor || "rider"].user._id,
          actors.other.user._id,
        ])
          for (const method of ["post", "put", "patch"])
            expect(
              (
                await api(actor, method, `/api/auth/${route}`, {
                  userId: String(target),
                  role: "admin",
                })
              ).status,
            ).toBe(404);
      expect(await snapshot()).toEqual(before);
    },
  );

  it.each([null, "rider", "driver"])(
    "%s cannot access any administrative route or change its records",
    async (actor) => {
      const before = await snapshot();
      const routes = [
        ...["users", "drivers", "rides", "payments"].map((kind) => [
          "get",
          `/api/admin/${kind}`,
        ]),
        [
          "patch",
          `/api/admin/users/${actors.other.user._id}/active`,
          { isActive: false },
        ],
        [
          "patch",
          `/api/admin/drivers/${actors.driver.profile._id}/verification`,
          { verificationStatus: "suspended" },
        ],
        [
          "patch",
          `/api/admin/vehicles/${actors.driver.vehicle._id}/verification`,
          { verificationStatus: "suspended" },
        ],
      ];
      for (const [method, path, body] of routes)
        expect((await api(actor, method, path, body)).status).toBe(
          actor ? 403 : 401,
        );
      expect(await snapshot()).toEqual(before);
    },
  );

  it("keeps the established admin approval and activation workflow working", async () => {
    for (const [kind, resource] of [
      ["drivers", actors.driver.profile],
      ["vehicles", actors.driver.vehicle],
    ]) {
      const response = await api(
        "admin",
        "patch",
        `/api/admin/${kind}/${resource._id}/verification`,
        {
          verificationStatus: "approved",
        },
      );
      expect(response.status).toBe(200);
      expect(response.body.data.verificationStatus).toBe("approved");
    }
    const path = `/api/admin/users/${actors.other.user._id}/active`;
    for (const isActive of [false, true]) {
      expect((await api("admin", "patch", path, { isActive })).status).toBe(
        200,
      );
      expect((await User.findById(actors.other.user._id)).isActive).toBe(
        isActive,
      );
    }
  });
});

describe("allowed fields", () => {
  it.each([
    ...privilegedFields,
    { accountType: "admin" },
    { accountType: "staff" },
  ])(
    "registration rejects privileged input %j without writing records",
    async (fields) => {
      const before = await snapshot();
      expect(
        (
          await api(null, "post", "/api/auth/register", {
            ...registration,
            email: "injection@example.test",
            phone: "+447700901234",
            ...fields,
          })
        ).status,
      ).toBe(400);
      expect(await snapshot()).toEqual(before);
    },
  );

  it.each(privilegedFields)(
    "profile, vehicle and admin updates reject %j without writing",
    async (fields) => {
      const before = await snapshot();
      for (const [actor, method, path, body] of [
        ["driver", "put", "/api/drivers/profile", { licenseNumber: "CHANGED" }],
        ["driver", "put", "/api/drivers/vehicle", vehicleInput],
        [
          "admin",
          "patch",
          `/api/admin/users/${actors.other.user._id}/active`,
          { isActive: false },
        ],
      ]) {
        // isActive is deliberately allowed only on the explicit admin activation route.
        if (path.endsWith("/active") && "isActive" in fields) continue;
        expect(
          (await api(actor, method, path, { ...body, ...fields })).status,
        ).toBe(400);
      }
      expect(await snapshot()).toEqual(before);
    },
  );

  it("rejects privileged registration even for direct service callers", async () => {
    const before = await snapshot();
    await expect(
      auth.register({ ...registration, role: "admin" }),
    ).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it("driver service field lists prevent ownership and permission injection", async () => {
    const before = await User.find().lean();
    const profile = await drivers.updateProfile(actors.driver.user, {
      licenseNumber: "SAFE",
      user: actors.other.user._id,
      ratingTotal: 999,
      role: "admin",
      permissions: ["admin"],
      walletBalance: 999,
      verificationStatus: "approved",
    });
    expect(String(profile.user)).toBe(String(actors.driver.user._id));
    expect(profile.ratingTotal).toBe(0);
    expect(profile.verificationStatus).toBe("pending");
    const vehicle = await drivers.updateVehicle(actors.driver.user, {
      ...vehicleInput,
      driver: actors.other.user._id,
      verificationStatus: "approved",
    });
    expect(String(vehicle.driver)).toBe(String(actors.driver.user._id));
    expect(vehicle.verificationStatus).toBe("pending");
    expect(await User.find().lean()).toEqual(before);
    expect(
      await DriverProfile.countDocuments({ user: actors.other.user._id }),
    ).toBe(0);
    expect(
      await Vehicle.countDocuments({ driver: actors.other.user._id }),
    ).toBe(0);
  });
});

describe("current database permissions", () => {
  it.each(["demoted", "disabled"])(
    "an %s admin cannot use an existing token",
    async (change) => {
      // A valid signed role claim is deliberately stale. Database state must win.
      actors.admin.token = jwt.sign(
        { role: "admin", permissions: ["admin"] },
        secret,
        {
          subject: String(actors.admin.user._id),
          expiresIn: "2h",
          issuer: "ride-core",
          audience: "ride-core-api",
        },
      );
      expect((await api("admin", "get", "/api/admin/users")).status).toBe(200);
      await User.updateOne(
        { _id: actors.admin.user._id },
        change === "demoted" ? { role: "rider" } : { isActive: false },
      );
      const before = await snapshot();
      const status = change === "demoted" ? 403 : 401;
      for (const kind of ["users", "drivers", "rides", "payments"])
        expect((await api("admin", "get", `/api/admin/${kind}`)).status).toBe(
          status,
        );
      for (const [path, body] of [
        [
          `/api/admin/users/${actors.other.user._id}/active`,
          { isActive: false },
        ],
        [
          `/api/admin/drivers/${actors.driver.profile._id}/verification`,
          { verificationStatus: "suspended" },
        ],
        [
          `/api/admin/vehicles/${actors.driver.vehicle._id}/verification`,
          { verificationStatus: "suspended" },
        ],
      ])
        expect((await api("admin", "patch", path, body)).status).toBe(status);
      expect(await snapshot()).toEqual(before);
    },
  );

  it("ignores a forged privilege claim in a correctly signed customer token", async () => {
    const token = jwt.sign({ role: "admin" }, secret, {
      subject: String(actors.rider.user._id),
      expiresIn: "2h",
      issuer: "ride-core",
      audience: "ride-core-api",
    });
    expect(
      (
        await request(app)
          .get("/api/admin/users")
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(403);
  });

  it.each(["demoted", "disabled"])(
    "an %s driver cannot update their profile with an old token",
    async (change) => {
      await User.updateOne(
        { _id: actors.driver.user._id },
        change === "demoted" ? { role: "rider" } : { isActive: false },
      );
      const before = await snapshot();
      expect(
        (
          await api("driver", "put", "/api/drivers/profile", {
            licenseNumber: "CHANGED",
          })
        ).status,
      ).toBe(change === "demoted" ? 403 : 401);
      expect(await snapshot()).toEqual(before);
    },
  );

  it("payment confirmation requires the active owning rider and never mutates on denial", async () => {
    const ride = await completedRide();
    const path = `/api/rides/${ride._id}/payment`;
    const before = await snapshot();
    for (const actor of [null, "other", "driver", "admin"])
      expect((await api(actor, "post", path, { method: "cash" })).status).toBe(
        actor ? 403 : 401,
      );
    expect(await snapshot()).toEqual(before);
    await User.updateOne({ _id: actors.rider.user._id }, { isActive: false });
    const disabled = await snapshot();
    expect((await api("rider", "post", path, { method: "cash" })).status).toBe(
      401,
    );
    expect(await snapshot()).toEqual(disabled);
    await User.updateOne(
      { _id: actors.rider.user._id },
      { isActive: true, role: "driver" },
    );
    const changed = await snapshot();
    expect((await api("rider", "post", path, { method: "cash" })).status).toBe(
      403,
    );
    expect(await snapshot()).toEqual(changed);
    expect(await Payment.countDocuments()).toBe(0);
  });
});
