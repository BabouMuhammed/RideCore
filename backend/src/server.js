import "dotenv/config";
import mongoose from "mongoose";
import { createHttpServer } from "./http-server.js";
import { connectDatabase } from "./config/db.js";
import { readFeatureSettings } from "./config/features.js";
import { readEnvironment } from "./config/env.js";
import { models } from "./models/index.js";
let server, io;
async function shutdown(code = 0) {
  const deadline = setTimeout(() => process.exit(1), 10000).unref();
  if (io) await new Promise((resolve) => io.close(resolve));
  else if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(deadline);
  process.exit(code);
}
try {
  const env = readEnvironment();
  await connectDatabase(env.MONGODB_URI);
  // Enforce conflict-prevention indexes before serving requests.
  await Promise.all(models.map((model) => model.init()));
  ({ server, io } = createHttpServer({
    jwtSecret: env.JWT_SECRET,
    corsOrigin: env.CORS_ORIGIN,
    features: readFeatureSettings(env),
    runtimeMode: env.NODE_ENV,
  }));
  server.listen(env.PORT);
  server.once("listening", () => {
    console.log(`RIDE CORE API running on port ${env.PORT}`);
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${env.PORT} is already in use. Stop the other backend instance before restarting.`,
      );
    } else if (error.code === "EACCES") {
      console.error(`Permission denied when binding to port ${env.PORT}.`);
    } else {
      console.error("HTTP server failed to start");
    }
    void shutdown(1);
  });
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
} catch (error) {
  console.error(
    error.message.startsWith("Invalid environment variables:") ||
      error.message === "MONGODB_URI is required"
      ? error.message
      : "API startup failed; check database connectivity and configuration",
  );
  await shutdown(1);
}
