import { pricing } from "../config/pricing.js";
import { requireThat } from "../utils/errors.js";
export function estimateFare({ pickup, destination, vehicleType }) {
  const valid = (p) =>
    Array.isArray(p?.location?.coordinates) &&
    p.location.coordinates.length === 2 &&
    p.location.coordinates.every(Number.isFinite) &&
    Math.abs(p.location.coordinates[0]) <= 180 &&
    Math.abs(p.location.coordinates[1]) <= 90;
  requireThat(
    valid(pickup) &&
      valid(destination) &&
      Object.hasOwn(pricing.multipliers, vehicleType),
    400,
    "Invalid pricing input",
  );
  const [lon1, lat1] = pickup.location.coordinates;
  const [lon2, lat2] = destination.location.coordinates;
  const rad = (n) => (n * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lon2 - lon1) / 2) ** 2;
  const distance =
    6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - Math.min(1, a)));
  const estimatedDuration = (distance / pricing.averageSpeedKmh) * 60;
  const estimatedFare =
    Math.round(
      (pricing.baseFare +
        distance * pricing.perKm +
        estimatedDuration * pricing.perMinute) *
        pricing.multipliers[vehicleType] *
        100,
    ) / 100;
  return {
    distance,
    estimatedDuration,
    estimatedFare,
    currency: pricing.currency,
    distanceMethod: "haversine_straight_line",
  };
}
