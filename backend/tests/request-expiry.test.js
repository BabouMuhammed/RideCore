import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setup, reset, cleanup, api, createRide } from "./helpers.js";
import { Ride } from "../src/models/index.js";
import { rideEvents } from "../src/realtime/ride-events.js";
import { expireStaleRequests, noDriverFound } from "../src/services/rides.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
const later = (seconds) => new Date(Date.now() + seconds * 1000);

describe("ride request expiry", () => {
  it("gives each new request an expiry time one minute out", async () => {
    const ride = await createRide();
    const left =
      Date.parse(ride.requestExpiresAt) - Date.parse(ride.requestedAt);
    expect(left).toBeGreaterThan(55000);
    expect(left).toBeLessThanOrEqual(61000);
  });

  it("leaves open requests alone", async () => {
    await createRide();
    expect(await expireStaleRequests()).toBe(0);
  });

  it("closes an unanswered request as no_driver_found and notifies", async () => {
    const ride = await createRide();
    const events = [];
    const listen = (event) => events.push(event);
    rideEvents.on("change", listen);
    try {
      expect(await expireStaleRequests(later(61))).toBe(1);
    } finally {
      rideEvents.off("change", listen);
    }
    const stored = await Ride.findById(ride._id);
    expect(stored.status).toBe("cancelled");
    expect(stored.active).toBe(false);
    expect(stored.cancellationReason).toBe(noDriverFound);
    expect(events).toEqual([
      expect.objectContaining({ rideId: ride._id, event: "ride:cancelled" }),
    ]);
    // The rider is free to book again.
    expect((await createRide()).status).toBe("requested");
  });

  it("never touches accepted rides", async () => {
    const ride = await createRide();
    await api("driver", "patch", `/api/rides/${ride._id}/accept`);
    expect(await expireStaleRequests(later(600))).toBe(0);
    expect((await Ride.findById(ride._id)).status).toBe("accepted");
  });

  it("hides and refuses requests past their expiry before the sweep runs", async () => {
    const ride = await createRide();
    await Ride.updateOne(
      { _id: ride._id },
      { requestExpiresAt: new Date(Date.now() - 1000) },
    );
    const listed = await api("driver", "get", "/api/drivers/ride-requests");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(0);
    const accept = await api(
      "driver",
      "patch",
      `/api/rides/${ride._id}/accept`,
    );
    expect(accept.status).toBe(409);
  });

  it("expires older requests that have no expiry field", async () => {
    const ride = await createRide();
    await Ride.updateOne(
      { _id: ride._id },
      {
        $unset: { requestExpiresAt: 1 },
        requestedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    );
    expect(await expireStaleRequests()).toBe(1);
  });
});
