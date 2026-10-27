import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachRealtime } from "./realtime/server.js";
export function createHttpServer(options = {}) {
  const app = createApp(options);
  const server = createServer(app);
  const io = attachRealtime(server, {
    jwtSecret: app.locals.jwtSecret,
    corsOrigin:
      options.corsOrigin || process.env.CORS_ORIGIN || "http://localhost:3000",
    features: app.locals.features,
  });
  return { app, server, io };
}
