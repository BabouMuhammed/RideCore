import { User, DriverProfile, Vehicle } from "../models/index.js";
import { resolveShareToken, validateShareGrant } from "./ride-shares.js";
const stopDto = (stop) => ({
  address: stop.address,
  latitude: stop.location.coordinates[1],
  longitude: stop.location.coordinates[0],
});
export async function sharedSnapshot(token) {
  const access = await resolveShareToken(token);
  const { ride, share } = access;
  const [driver, profile, vehicle] = await Promise.all([
    User.findById(ride.driver).select("firstName"),
    DriverProfile.findOne({ user: ride.driver }).select("ratingAverage"),
    Vehicle.findOne({ driver: ride.driver }).select(
      "make model color plateNumber",
    ),
  ]);
  // Never fall back to DriverProfile.currentLocation (which can be unrelated/off-duty).
  const sample = ride.trackingLocation;
  const data = {
    rideStatus: ride.status,
    driver: driver
      ? { firstName: driver.firstName, rating: profile?.ratingAverage ?? 0 }
      : null,
    vehicle: vehicle
      ? {
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          plateNumber: vehicle.plateNumber,
        }
      : null,
    location: sample
      ? {
          latitude: sample.location.coordinates[1],
          longitude: sample.location.coordinates[0],
          updatedAt: sample.updatedAt.toISOString(),
        }
      : null,
    trip: {
      pickup: stopDto(ride.pickup),
      destination: stopDto(ride.destination),
    },
    sharing: { expiresAt: share.expiresAt.toISOString() },
  };
  // Recheck after DTO lookups so expiry/revocation/end during those reads denies access.
  await validateShareGrant(access.grant);
  return { data, grant: access.grant };
}
