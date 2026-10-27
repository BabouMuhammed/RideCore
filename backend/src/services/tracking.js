import { trackingEvents } from "../realtime/share-events.js";
import { Ride, DriverProfile } from "../models/index.js";
import { requireThat } from "../utils/errors.js";
export const trackableStates = Object.freeze([
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
]);
export async function participantRide(rideId, user) {
  const ride = await Ride.findById(rideId);
  requireThat(ride, 404, "Ride not found");
  requireThat(
    String(ride.rider) === String(user._id) ||
      String(ride.driver) === String(user._id),
    403,
    "Ride participant required",
  );
  return ride;
}
export async function joinableRide(rideId, user) {
  const ride = await participantRide(rideId, user);
  requireThat(ride.active, 409, "Ride is no longer active");
  return ride;
}
export async function updateTrackedLocation(user, input, persistIntervalMs) {
  requireThat(user.role === "driver", 403, "Assigned driver required");
  const ride = await participantRide(input.rideId, user);
  requireThat(
    String(ride.driver) === String(user._id),
    403,
    "Assigned driver required",
  );
  requireThat(
    trackableStates.includes(ride.status) && ride.active,
    409,
    "Ride is not trackable",
  );
  const now = new Date();
  // Shared MongoDB timestamp makes throttling survive reconnects and multiple sockets.
  await DriverProfile.updateOne(
    {
      user: user._id,
      $or: [
        { locationPersistedAt: { $exists: false } },
        {
          locationPersistedAt: {
            $lte: new Date(now.getTime() - persistIntervalMs),
          },
        },
      ],
    },
    {
      currentLocation: {
        type: "Point",
        coordinates: [input.longitude, input.latitude],
      },
      locationPersistedAt: now,
    },
    { runValidators: true },
  );
  await Ride.updateOne(
    {
      _id: ride._id,
      driver: user._id,
      active: true,
      status: { $in: trackableStates },
      $or: [
        { trackingLocation: { $exists: false } },
        {
          "trackingLocation.updatedAt": {
            $lte: new Date(now.getTime() - persistIntervalMs),
          },
        },
      ],
    },
    {
      trackingLocation: {
        location: {
          type: "Point",
          coordinates: [input.longitude, input.latitude],
        },
        updatedAt: now,
      },
    },
    { runValidators: true },
  );
  // Recheck after persistence so a completed/cancelled ride cannot be broadcast from an old read.
  requireThat(
    await Ride.exists({
      _id: ride._id,
      driver: user._id,
      active: true,
      status: { $in: trackableStates },
    }),
    409,
    "Ride is not trackable",
  );
  const event = { ...input, timestamp: now.toISOString() };
  trackingEvents.emit("location", event);
  return event;
}
