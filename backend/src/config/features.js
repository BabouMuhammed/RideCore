import { z } from "zod";
export const featureEnvironmentSchema = z.object({
  RIDE_SHARE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86400)
    .default(14400),
  RIDE_SHARE_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .max(600)
    .default(120),
  DRIVER_SEARCH_RADIUS_KM: z.coerce.number().positive().max(100).default(10),
  LOCATION_PERSIST_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(5000),
  OTP_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(300)
    .default(60),
  // A request no driver accepts within this time is closed as
  // "no_driver_found", so riders are never left waiting indefinitely.
  RIDE_REQUEST_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3600)
    .default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  // No SMS provider is connected yet. "true" returns the code in the API
  // response even in production, for demonstration deployments only.
  OTP_MOCK_DELIVERY: z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((value) => value === "true"),
    ])
    .default(false),
});
export function readFeatureSettings(env = process.env) {
  const result = featureEnvironmentSchema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid environment variables: ${result.error.issues.map((i) => i.path[0]).join(", ")}`,
    );
  return result.data;
}
// MongoDB spherical query conversion; keep radius units consistent with geo queries.
// https://www.mongodb.com/docs/manual/core/indexes/index-types/geospatial/2d/calculate-distances/
export const earthRadiusKm = 6378.1;
