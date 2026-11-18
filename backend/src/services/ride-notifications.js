import { User, Vehicle } from "../models/index.js";
import { readFeatureSettings } from "../config/features.js";
import { nearbyDrivers, noDriverFoundReason } from "./nearby.js";
import { notifyUsers } from "./push.js";

// Lock-screen notifications for the moments that matter when the app
// isn't on screen. All calls are fire-and-forget (see notifyUsers).
const place = (stop) => stop.address.split(",")[0].trim();
async function car(driverId) {
  const [driver, vehicle] = await Promise.all([
    User.findById(driverId).select("firstName").lean(),
    Vehicle.findOne({ driver: driverId })
      .select("make model color plateNumber")
      .lean(),
  ]);
  return {
    name: driver?.firstName ?? "Your driver",
    car: vehicle
      ? `${vehicle.color} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`
      : "",
  };
}

/** After a ride changes: tell the other person what happened. */
export async function notifyRideChange(ride, actorId) {
  const rider = [ride.rider];
  switch (ride.status) {
    case "accepted": {
      const { name, car: vehicle } = await car(ride.driver);
      return notifyUsers(rider, {
        title: `${name} is on the way`,
        body: vehicle ? `Look out for the ${vehicle}` : "Your driver accepted",
        tag: `ride-${ride._id}`,
      });
    }
    case "driver_arrived": {
      const { car: vehicle } = await car(ride.driver);
      return notifyUsers(rider, {
        title: "Your driver has arrived",
        body: vehicle
          ? `Meet the ${vehicle} at your pickup`
          : "Meet them at your pickup",
        tag: `ride-${ride._id}`,
        requireInteraction: true,
      });
    }
    case "completed":
      return notifyUsers(rider, {
        title: `You’ve arrived at ${place(ride.destination)}`,
        body: "Thanks for riding with RideCore.",
        tag: `ride-${ride._id}`,
      });
    case "cancelled": {
      if (ride.cancellationReason === noDriverFoundReason)
        return notifyUsers(rider, {
          title: "No driver found",
          body: "No driver accepted in time. Open RideCore to try again.",
          tag: `ride-${ride._id}`,
        });
      const byRider = String(actorId) === String(ride.rider);
      if (byRider && ride.driver)
        return notifyUsers([ride.driver], {
          title: "The rider cancelled",
          body: `Trip from ${place(ride.pickup)} was cancelled.`,
          tag: `ride-${ride._id}`,
        });
      if (!byRider)
        return notifyUsers(rider, {
          title: "Your driver cancelled",
          body: "Open RideCore to request another ride.",
          tag: `ride-${ride._id}`,
        });
      return 0;
    }
    default:
      return 0;
  }
}

/** A new request: alert the online drivers nearby who can take it. */
export async function notifyNewRequest(ride) {
  const drivers = await nearbyDrivers(
    ride.pickup.location.coordinates,
    readFeatureSettings().DRIVER_SEARCH_RADIUS_KM,
    ride.vehicleType,
  );
  return notifyUsers(
    drivers.map((d) => d.driverId),
    {
      title: "New ride request",
      body: `Pickup ${place(ride.pickup)} · ${ride.currency} ${ride.estimatedFare.toFixed(2)}`,
      tag: `request-${ride._id}`,
    },
  );
}
