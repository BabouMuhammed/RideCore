import { z } from "zod";
import { featureEnvironmentSchema } from "./features.js";
export function parseOrigins(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
export function readEnvironment(env = process.env) {
  const result = z
    .object({
      MONGODB_URI: z.string().min(1),
      JWT_SECRET: z.string().min(32),
      PORT: z.coerce.number().int().min(1).max(65535).default(5050),
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      // One or more allowed web origins, separated by commas.
      CORS_ORIGIN: z
        .string()
        .default("http://localhost:3000")
        .refine(
          (value) =>
            parseOrigins(value).length > 0 &&
            parseOrigins(value).every((origin) => URL.canParse(origin)),
          "CORS_ORIGIN must be one or more URLs separated by commas",
        ),
      // Number of proxy hops in front of the API (1 on Render, Railway or Fly).
      TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    })
    .extend(featureEnvironmentSchema.shape)
    .safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid environment variables: ${[...new Set(result.error.issues.map((i) => i.path[0]))].join(", ")}`,
    );
  return result.data;
}
