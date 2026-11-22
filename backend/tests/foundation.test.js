import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readEnvironment } from "../src/config/env.js";
import { connectDatabase } from "../src/config/db.js";
import { estimateFare } from "../src/services/pricing.js";
import { rideInput } from "../src/routes/schemas.js";
const stop = (coordinates) => ({
  address: "Test address",
  location: { type: "Point", coordinates },
});
export const input = {
  pickup: stop([-0.12, 51.5]),
  destination: stop([-0.1, 51.52]),
  vehicleType: "economy",
};
describe("foundation and pricing", () => {
  it("fails safely when database URI is missing", async () => {
    await expect(connectDatabase("")).rejects.toThrow("MONGODB_URI");
  });
  it("validates environment without exposing secrets", () => {
    expect(() => readEnvironment({})).toThrow("Invalid environment variables");
    expect(
      readEnvironment({
        MONGODB_URI: "mongodb://localhost/test",
        JWT_SECRET: "x".repeat(32),
      }).PORT,
    ).toBe(5050);
  });
  it("reports disconnected health", async () => {
    const r = await request(createApp()).get("/api/health");
    expect(r.status).toBe(503);
    expect(r.body.database).toBe("disconnected");
  });
  it("returns consistent not-found errors", async () => {
    expect((await request(createApp()).get("/missing")).status).toBe(404);
  });
  it("calculates deterministic base fare", () => {
    const fare = estimateFare({ ...input, destination: input.pickup });
    expect(fare.estimatedFare).toBe(75);
    expect(fare.distance).toBe(0);
    expect(fare.currency).toBe("GMD");
  });
  it("uses haversine distance and a transparent formula", () => {
    const fare = estimateFare(input);
    expect(fare.distance).toBeCloseTo(2.62, 1);
    expect(fare.estimatedFare).toBe(
      Math.round((75 + fare.distance * 25 + fare.estimatedDuration * 5) / 5) *
        5,
    );
    expect(fare.distanceMethod).toBe("haversine_straight_line");
  });
  it.each([
    ["comfort", 1.3],
    ["xl", 1.6],
  ])("supports %s multiplier", (vehicleType, multiplier) => {
    const base = estimateFare({
      ...input,
      destination: input.pickup,
      vehicleType,
    });
    expect(base.estimatedFare).toBe(Math.round((75 * multiplier) / 5) * 5);
  });
  it("rejects invalid coordinates at API and service boundaries", () => {
    const bad = { ...input, pickup: stop([181, 91]) };
    expect(rideInput.safeParse(bad).success).toBe(false);
    expect(() => estimateFare(bad)).toThrow("Invalid pricing input");
    expect(() => estimateFare({ ...input, vehicleType: "toString" })).toThrow();
  });
});
