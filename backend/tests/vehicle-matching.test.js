import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  rideInput,
  location,
} from "./helpers.js";
import { Vehicle } from "../src/models/index.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);

const setType = (name, vehicleType) =>
  Vehicle.updateOne({ driver: actors[name].user._id }, { vehicleType });
const request = async (vehicleType) => {
  const r = await api("rider", "post", "/api/rides", {
    ...rideInput,
    vehicleType,
  });
  expect(r.status).toBe(201);
  return r.body.data;
};
const requestsFor = async (name) =>
  (await api(name, "get", "/api/drivers/ride-requests")).body.data;

describe("which drivers can take which requests", () => {
  it("lets a Comfort car see and accept an Economy request", async () => {
    await setType("driver", "comfort");
    const ride = await request("economy");
    expect((await requestsFor("driver")).map((r) => r._id)).toEqual([ride._id]);
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(200);
  });

  it("never sends a bigger request to a smaller car", async () => {
    // Both test drivers have Economy cars.
    const ride = await request("xl");
    expect(await requestsFor("driver")).toEqual([]);
    expect(
      (await api("driver", "patch", `/api/rides/${ride._id}/accept`)).status,
    ).toBe(409);
    await setType("driver2", "xl");
    expect((await requestsFor("driver2")).map((r) => r._id)).toEqual([
      ride._id,
    ]);
  });

  it("counts only drivers who can take the rider's ride type", async () => {
    await setType("driver2", "comfort");
    const [lng, lat] = location.coordinates;
    const count = async (type) =>
      (
        await api(
          "rider",
          "get",
          `/api/drivers/nearby?lat=${lat}&lng=${lng}${type ? `&vehicleType=${type}` : ""}`,
        )
      ).body.data.length;
    expect(await count()).toBe(2);
    expect(await count("economy")).toBe(2);
    expect(await count("comfort")).toBe(1);
    expect(await count("xl")).toBe(0);
  });
});
