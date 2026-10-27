import { endRideShares } from "./share-lifecycle.js";
import { publishShareEnded } from "../realtime/share-events.js";
import { publishRideChange } from "../realtime/ride-events.js";
import mongoose from "mongoose";
import { Ride, DriverProfile, User } from "../models/index.js";
import { requireThat } from "../utils/errors.js";
import { estimateFare } from "./pricing.js";
import { eligibleDriver } from "./drivers.js";
import { nearbyRideRequests, pickupWithinRadius } from "./nearby.js";
export const transitions = Object.freeze({
  arriving: ["accepted", "driver_arriving", "arrivingAt"],
  arrived: ["driver_arriving", "driver_arrived", "arrivedAt"],
  start: ["driver_arrived", "in_progress", "startedAt"],
  complete: ["in_progress", "completed", "completedAt"],
});
export async function createRide(user, input) {
  const estimate = estimateFare(input);
  return mongoose.connection.transaction(async (session) => {
    const active = await User.findOneAndUpdate(
      { _id: user._id, isActive: true },
      { $inc: { __v: 1 } },
      { session },
    );
    requireThat(active, 401, "Authentication required");
    const [ride] = await Ride.create(
      [
        {
          ...input,
          rider: user._id,
          distance: estimate.distance,
          estimatedDuration: estimate.estimatedDuration,
          estimatedFare: estimate.estimatedFare,
          currency: estimate.currency,
        },
      ],
      { session },
    );
    return ride;
  });
}
export async function getRide(id, user, session) {
  const ride = await Ride.findById(id).session(session || null);
  requireThat(ride, 404, "Ride not found");
  requireThat(
    user.role === "admin" ||
      String(ride.rider) === String(user._id) ||
      String(ride.driver) === String(user._id),
    403,
    "Access denied",
  );
  return ride;
}
export async function rideRequests(user, radiusKm) {
  const { profile, vehicle } = await eligibleDriver(user._id);
  requireThat(
    profile.availabilityStatus === "online",
    409,
    "Driver must be online",
  );
  return nearbyRideRequests(profile, vehicle, radiusKm);
}
export async function acceptRide(id, user, radiusKm) {
  const result = await mongoose.connection.transaction(async (session) => {
    const active = await User.findOneAndUpdate(
      { _id: user._id, isActive: true },
      { $inc: { __v: 1 } },
      { session },
    );
    requireThat(active, 401, "Authentication required");
    const { vehicle } = await eligibleDriver(user._id, session);
    const profile = await DriverProfile.findOneAndUpdate(
      {
        user: user._id,
        availabilityStatus: "online",
        currentLocation: { $exists: true },
      },
      { availabilityStatus: "busy" },
      { returnDocument: "after", session },
    );
    requireThat(profile, 409, "Driver must be online and available");
    const ride = await Ride.findOneAndUpdate(
      {
        _id: id,
        status: "requested",
        vehicleType: vehicle.vehicleType,
        rider: { $ne: user._id },
        "pickup.location": pickupWithinRadius(
          profile.currentLocation.coordinates,
          radiusKm,
        ),
      },
      { driver: user._id, status: "accepted", acceptedAt: new Date() },
      { returnDocument: "after", session },
    );
    requireThat(ride, 409, "Ride is unavailable or incompatible");
    return ride;
  });
  publishRideChange(result);
  return result;
}
export async function progressRide(id, user, action) {
  const [from, to, timestamp] = transitions[action];
  const result = await mongoose.connection.transaction(async (session) => {
    const ride = await getRide(id, user, session);
    requireThat(
      String(ride.driver) === String(user._id),
      403,
      "Assigned driver required",
    );
    requireThat(ride.status === from, 409, "Invalid ride state transition");
    const update = { status: to, [timestamp]: new Date() };
    if (to === "completed") {
      update.active = false;
      update.finalFare = ride.estimatedFare;
      update.$unset = { trackingLocation: 1 };
    }
    const changed = await Ride.findOneAndUpdate(
      { _id: id, status: from },
      update,
      { returnDocument: "after", session },
    );
    requireThat(changed, 409, "Ride changed; retry");
    if (to === "completed")
      await DriverProfile.updateOne(
        { user: user._id },
        { availabilityStatus: "offline" },
        { session },
      );
    const shareKeys =
      to === "completed"
        ? await endRideShares(id, "ride_completed", session)
        : [];
    return { ride: changed, shareKeys };
  });
  publishRideChange(result.ride);
  for (const key of result.shareKeys) publishShareEnded(key, "ride_completed");
  return result.ride;
}
export async function cancelRide(id, user, reason) {
  const result = await mongoose.connection.transaction(async (session) => {
    const ride = await getRide(id, user, session);
    requireThat(
      ["requested", "accepted", "driver_arriving", "driver_arrived"].includes(
        ride.status,
      ),
      409,
      "Ride cannot be cancelled at this stage",
    );
    const changed = await Ride.findOneAndUpdate(
      { _id: id, status: ride.status },
      {
        status: "cancelled",
        active: false,
        cancelledAt: new Date(),
        cancellationReason: reason,
        $unset: { trackingLocation: 1 },
      },
      { returnDocument: "after", session },
    );
    requireThat(changed, 409, "Ride changed; retry");
    if (ride.driver)
      await DriverProfile.updateOne(
        { user: ride.driver },
        { availabilityStatus: "offline" },
        { session },
      );
    const shareKeys = await endRideShares(id, "ride_cancelled", session);
    return { ride: changed, shareKeys };
  });
  publishRideChange(result.ride);
  for (const key of result.shareKeys) publishShareEnded(key, "ride_cancelled");
  return result.ride;
}
