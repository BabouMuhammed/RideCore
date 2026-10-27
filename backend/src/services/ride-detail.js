import { User, DriverProfile, Vehicle, Rating } from "../models/index.js";
import { getRide } from "./rides.js";
// Additive participant-only presentation data. Check authorization BEFORE any lookups.
export async function rideDetail(id, actor) {
  const ride = await getRide(id, actor);
  const [driver, profile, vehicle, rider, myRating] = await Promise.all([
    ride.driver ? User.findById(ride.driver).select("firstName -_id") : null,
    ride.driver
      ? DriverProfile.findOne({ user: ride.driver }).select(
          "verificationStatus ratingAverage -_id",
        )
      : null,
    ride.driver
      ? Vehicle.findOne({ driver: ride.driver }).select(
          "make model color plateNumber vehicleType seats verificationStatus -_id",
        )
      : null,
    ["driver", "admin"].includes(actor.role)
      ? User.findById(ride.rider).select("firstName -_id")
      : null,
    Rating.findOne({ ride: id, reviewer: actor._id }).select(
      "rating comment createdAt -_id",
    ),
  ]);
  return {
    ...ride.toJSON(),
    currency: ride.currency || "GBP",
    driverDetails: driver
      ? {
          firstName: driver.firstName,
          verificationStatus: profile?.verificationStatus || "unknown",
          rating: profile?.ratingAverage ?? null,
        }
      : null,
    vehicle: vehicle?.toJSON() || null,
    riderDetails: rider ? { firstName: rider.firstName } : null,
    myRating: myRating?.toJSON() || null,
  };
}
