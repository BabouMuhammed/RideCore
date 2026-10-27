import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  acceptedRide,
  createRide,
  completedRide,
} from "./helpers.js";
import { Ride, Payment } from "../src/models/index.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
it("new fares, stored rides and simulated payments use the GMD contract", async () => {
  const ride = await completedRide();
  expect(ride.currency).toBe("GMD");
  const paid = await api("rider", "post", `/api/rides/${ride._id}/payment`, {
    method: "cash",
  });
  expect(paid.status).toBe(200);
  expect(paid.body.data.currency).toBe("GMD");
  expect(paid.body.data.amount).toBe(ride.finalFare);
});
it("historical currency-less rides remain GBP and are not relabelled during payment", async () => {
  const ride = await completedRide();
  await Ride.collection.updateOne(
    { _id: ride._id },
    { $unset: { currency: 1 } },
  );
  const detail = await api("rider", "get", `/api/rides/${ride._id}`);
  expect(detail.body.data.currency).toBe("GBP");
  const paid = await api("rider", "post", `/api/rides/${ride._id}/payment`, {
    method: "cash",
  });
  expect(paid.body.data.currency).toBe("GBP");
  expect(paid.body.data.amount).toBe(ride.finalFare);
  expect(
    (await Ride.collection.findOne({ _id: ride._id })).currency,
  ).toBeUndefined();
});
it("authorized ride details expose safe identity, vehicle and only the viewer's rating", async () => {
  const ride = await completedRide();
  await api("rider", "post", `/api/rides/${ride._id}/ratings`, {
    rating: 4,
    comment: "Good ride",
  });
  const rider = await api("rider", "get", `/api/rides/${ride._id}`);
  expect(rider.body.data.driverDetails.firstName).toBe(
    actors.driver.user.firstName,
  );
  expect(rider.body.data.vehicle.plateNumber).toBe(
    actors.driver.vehicle.plateNumber,
  );
  expect(rider.body.data.myRating.rating).toBe(4);
  expect(rider.body.data.riderDetails).toBeNull();
  const driver = await api("driver", "get", `/api/rides/${ride._id}`);
  expect(driver.body.data.riderDetails.firstName).toBe(
    actors.rider.user.firstName,
  );
  expect(driver.body.data.myRating).toBeNull();
  for (const field of ["password", "phone", "email", "licenseNumber"])
    expect(JSON.stringify(rider.body.data)).not.toContain(`"${field}"`);
});
it("detail enrichment never makes a ride visible to unrelated accounts", async () => {
  const ride = await acceptedRide();
  const result = await api("other", "get", `/api/rides/${ride._id}`);
  expect(result.status).toBe(403);
  expect(result.body.data).toBeUndefined();
});
it("existing admin driver list includes its actual vehicle, never password hashes", async () => {
  const result = await api("admin", "get", "/api/admin/drivers");
  expect(result.status).toBe(200);
  const row = result.body.data.find(
    (d) => d._id === String(actors.driver.profile._id),
  );
  expect(row.vehicle._id).toBe(String(actors.driver.vehicle._id));
  expect(row.account.isActive).toBe(true);
  expect(JSON.stringify(result.body)).not.toContain('"password"');
  expect((await api("driver", "get", "/api/admin/drivers")).status).toBe(403);
});
it("client-supplied currency or amount cannot override server money", async () => {
  const ride = await completedRide();
  expect(
    (
      await api("rider", "post", `/api/rides/${ride._id}/payment`, {
        method: "cash",
        currency: "GBP",
        amount: 0,
      })
    ).status,
  ).toBe(400);
  expect(await Payment.countDocuments()).toBe(0);
});

it("nearby request projections retain the ride's currency", async () => {
  const ride = await createRide();
  const requests = await api("driver", "get", "/api/drivers/ride-requests");
  expect(requests.status).toBe(200);
  expect(
    requests.body.data.find((item) => item._id === String(ride._id)).currency,
  ).toBe("GMD");
});
