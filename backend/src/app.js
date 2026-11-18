import { readFeatureSettings } from "./config/features.js";
import { parseOrigins } from "./config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { apiRoutes } from "./routes/index.js";
import { errorHandler, notFound } from "./utils/errors.js";
export function createApp({
  jwtSecret = process.env.JWT_SECRET,
  features = readFeatureSettings(),
  runtimeMode = process.env.NODE_ENV || "development",
  corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000",
  logging = process.env.NODE_ENV !== "test",
  trustProxy = Number(process.env.TRUST_PROXY) || 0,
} = {}) {
  const app = express();
  app.locals.jwtSecret = jwtSecret;
  app.locals.features = features;
  app.locals.runtimeMode = runtimeMode;
  app.disable("x-powered-by");
  // Behind a hosting proxy, use the client's address for rate limiting.
  if (trustProxy) app.set("trust proxy", trustProxy);
  app.use(helmet());
  app.use(cors({ origin: parseOrigins(corsOrigin) }));
  app.use(express.json({ limit: "32kb" }));
  if (logging) app.use(morgan(":method :status :response-time ms"));
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { success: false, error: { message: "Too many requests" } },
    }),
  );
  app.get("/api/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      success: connected,
      service: "RIDE CORE API",
      message: "RIDE CORE API is running",
      database: connected ? "connected" : "disconnected",
    });
  });
  app.use("/api", apiRoutes(features));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
export default createApp();
