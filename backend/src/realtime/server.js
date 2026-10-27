import { attachSharedRides } from "./shared-rides.js";
import { Server } from "socket.io";
import { verifyIdentity } from "../services/identity.js";
import { joinableRide, updateTrackedLocation } from "../services/tracking.js";
import { ApiError } from "../utils/errors.js";
import { roomInput, trackingInput } from "./schemas.js";
import { rideEvents } from "./ride-events.js";
const room = (id) => `ride:${id.toLowerCase()}`;
export function attachRealtime(
  httpServer,
  { jwtSecret, corsOrigin, features },
) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin },
    maxHttpBufferSize: 8192,
    allowRequest: (req, done) =>
      done(null, !req.headers.origin || req.headers.origin === corsOrigin),
  });
  attachSharedRides(io, features);
  const rateWindows = new Map();
  const cleanRates = setInterval(() => {
    const cutoff = Date.now() - 60000;
    for (const [id, window] of rateWindows)
      if (window.started < cutoff) rateWindows.delete(id);
  }, 60000).unref();
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string")
        throw new ApiError(401, "Authentication required");
      const identity = await verifyIdentity(token, jwtSecret);
      socket.data.token = token;
      socket.data.identity = identity;
      next();
    } catch {
      const error = new Error("Authentication required");
      error.data = { status: 401 };
      next(error);
    }
  });
  io.on("connection", (socket) => {
    const identity = socket.data.identity;
    const expiryMs = Math.max(
      0,
      (identity.expiresAt || Date.now() + 2 * 60 * 60 * 1000) - Date.now(),
    );
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.min(expiryMs, 2147483647),
    ).unref();
    socket.on("disconnect", () => clearTimeout(expiryTimer));
    const handler = (schema, action) => async (payload, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      try {
        const id = String(identity.user._id);
        const now = Date.now();
        let window = rateWindows.get(id);
        if (!window || now - window.started >= 1000) {
          window = { started: now, count: 0 };
          rateWindows.set(id, window);
        }
        if (++window.count > 20)
          throw new ApiError(429, "Too many socket events");
        const parsed = schema.safeParse(payload);
        if (!parsed.success) throw new ApiError(400, "Invalid socket payload");
        // Recheck token expiry and suspension on every incoming operation.
        const { user } = await verifyIdentity(socket.data.token, jwtSecret);
        const data = await action(parsed.data, user);
        reply({ success: true, data });
      } catch (error) {
        if (!error.status) console.error("Realtime operation failed");
        reply({
          success: false,
          error: {
            status: error.status || 500,
            message: error.status ? error.message : "Internal server error",
          },
        });
        if (error.status === 401) socket.disconnect(true);
      }
    };
    socket.on(
      "ride:join",
      handler(roomInput, async (input, user) => {
        await joinableRide(input.rideId, user);
        await socket.join(room(input.rideId));
        return { rideId: input.rideId.toLowerCase() };
      }),
    );
    socket.on(
      "ride:leave",
      handler(roomInput, async (input) => {
        await socket.leave(room(input.rideId));
        return { rideId: input.rideId.toLowerCase() };
      }),
    );
    socket.on(
      "driver:location:update",
      handler(trackingInput, async (input, user) => {
        const event = await updateTrackedLocation(
          user,
          { ...input, rideId: input.rideId.toLowerCase() },
          features.LOCATION_PERSIST_INTERVAL_MS,
        );
        io.to(room(event.rideId)).emit("driver:location", event);
        return { rideId: event.rideId, timestamp: event.timestamp };
      }),
    );
  });
  const changed = (payload) => {
    const { event, ...data } = payload;
    io.to(room(payload.rideId)).emit(event, data);
    if (["completed", "cancelled"].includes(payload.status))
      io.in(room(payload.rideId)).socketsLeave(room(payload.rideId));
  };
  rideEvents.on("change", changed);
  httpServer.once("close", () => {
    rideEvents.off("change", changed);
    clearInterval(cleanRates);
    rateWindows.clear();
  });
  return io;
}
