import { z } from "zod";
import { DriverProfile, Ride } from "../models/index.js";
import { point } from "../routes/schemas.js";
import { requireThat } from "../utils/errors.js";
import { readFeatureSettings, earthRadiusKm } from "../config/features.js";
export function searchRadius(
  radiusKm = readFeatureSettings().DRIVER_SEARCH_RADIUS_KM,
) {
  requireThat(
    z.number().positive().max(100).safeParse(radiusKm).success,
    400,
    "Invalid search radius",
  );
  return radiusKm;
}
export function searchOrigin(coordinates) {
  const result = point.safeParse({ type: "Point", coordinates });
  requireThat(result.success, 400, "Invalid search coordinates");
  return result.data;
}
// Bigger cars may take smaller requests (as on Uber): a Comfort car can
// carry an Economy rider, an XL car any rider. Never the other way round.
export const requestTypesServedBy = {
  economy: ["economy"],
  comfort: ["economy", "comfort"],
  xl: ["economy", "comfort", "xl"],
};
export function vehicleTypesServing(requestType) {
  return Object.keys(requestTypesServedBy).filter((type) =>
    requestTypesServedBy[type].includes(requestType),
  );
}
export async function nearbyDrivers(coordinates, radiusKm, requestType) {
  const origin = searchOrigin(coordinates);
  const radius = searchRadius(radiusKm);
  return DriverProfile.aggregate([
    {
      $geoNear: {
        key: "currentLocation",
        near: origin,
        distanceField: "distanceMeters",
        maxDistance: radius * 1000,
        spherical: true,
        query: { verificationStatus: "approved", availabilityStatus: "online" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "account",
      },
    },
    { $match: { account: { $elemMatch: { role: "driver", isActive: true } } } },
    {
      $lookup: {
        from: "vehicles",
        localField: "user",
        foreignField: "driver",
        as: "vehicle",
      },
    },
    { $unwind: "$vehicle" },
    {
      $match: {
        "vehicle.verificationStatus": "approved",
        // Only drivers who can take this kind of request, when one is given.
        ...(requestType && {
          "vehicle.vehicleType": { $in: vehicleTypesServing(requestType) },
        }),
      },
    },
    {
      $lookup: {
        from: "rides",
        let: { driverId: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$driver", "$$driverId"] },
                  { $eq: ["$active", true] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "activeRides",
      },
    },
    { $match: { "activeRides.0": { $exists: false } } },
    { $limit: 50 },
    {
      $project: {
        _id: 0,
        driverId: "$user",
        profileId: "$_id",
        location: "$currentLocation",
        vehicle: {
          make: "$vehicle.make",
          model: "$vehicle.model",
          vehicleType: "$vehicle.vehicleType",
        },
        ratingAverage: 1,
        ratingCount: 1,
        distanceKm: { $divide: ["$distanceMeters", 1000] },
      },
    },
  ]);
}
export const defaultTimeoutSeconds = 60;
// Requests created before expiry existed have no requestExpiresAt; treat them
// as expiring a default interval after they were requested.
export function openRequestFilter(now = new Date()) {
  return {
    $or: [
      { requestExpiresAt: { $gt: now } },
      {
        requestExpiresAt: { $exists: false },
        requestedAt: { $gt: new Date(now - defaultTimeoutSeconds * 1000) },
      },
    ],
  };
}
export async function nearbyRideRequests(profile, vehicle, radiusKm) {
  requireThat(profile.currentLocation, 409, "Set a location before discovery");
  requireThat(
    !(await Ride.exists({ driver: profile.user, active: true })),
    409,
    "Driver already has an active ride",
  );
  const origin = searchOrigin(profile.currentLocation.coordinates);
  return Ride.find({
    status: "requested",
    active: true,
    ...openRequestFilter(),
    vehicleType: {
      $in: requestTypesServedBy[vehicle.vehicleType] ?? [vehicle.vehicleType],
    },
    "pickup.location": {
      $near: { $geometry: origin, $maxDistance: searchRadius(radiusKm) * 1000 },
    },
  })
    .select(
      "pickup destination distance estimatedDuration estimatedFare currency vehicleType requestedAt requestExpiresAt",
    )
    .limit(50);
}
export function pickupWithinRadius(coordinates, radiusKm) {
  searchOrigin(coordinates);
  return {
    $geoWithin: {
      $centerSphere: [coordinates, searchRadius(radiusKm) / earthRadiusKm],
    },
  };
}
