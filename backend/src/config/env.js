import { z } from "zod";
import { featureEnvironmentSchema } from "./features.js";
export function readEnvironment(env = process.env) {
  const result = z
    .object({
      MONGODB_URI: z.string().min(1),
      JWT_SECRET: z.string().min(32),
      PORT: z.coerce.number().int().min(1).max(65535).default(5050),
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
    })
    .extend(featureEnvironmentSchema.shape)
    .safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid environment variables: ${[...new Set(result.error.issues.map((i) => i.path[0]))].join(", ")}`,
    );
  return result.data;
}
