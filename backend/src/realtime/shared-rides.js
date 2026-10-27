import { z } from "zod";
import { ApiError } from "../utils/errors.js";
import {
  shareToken,
  unavailable,
  validateShareGrant,
} from "../services/ride-shares.js";
import { sharedSnapshot } from "../services/share-snapshot.js";
import { shareEvents, trackingEvents } from "./share-events.js";
import { rideEvents } from "./ride-events.js";
const joinInput = z.object({ token: shareToken }).strict();
const publicRoom = (key) => `share:${key}`;
export function attachSharedRides(io, features) {
  // Separate namespace: root namespace JWT middleware/handlers are never relaxed.
  const namespace = io.of("/shared-rides");
  const rooms = new Map();
  const windows = new Map();
  function take(ip, kind, limit) {
    const key = `${kind}:${ip}`;
    const now = Date.now();
    let entry = windows.get(key);
    if (!entry || now - entry.started >= 60000) {
      entry = { started: now, count: 0 };
      windows.set(key, entry);
    }
    if (++entry.count > limit)
      throw new ApiError(429, "Too many shared ride attempts");
  }
  function detach(socket) {
    const key = socket.data.shareKey;
    if (!key) return;
    socket.leave(publicRoom(key));
    delete socket.data.shareKey;
    if (!namespace.adapter.rooms.get(publicRoom(key))?.size) {
      clearTimeout(rooms.get(key)?.timer);
      rooms.delete(key);
    }
  }
  function end(key, reason) {
    const entry = rooms.get(key);
    if (!entry) return;
    namespace.to(publicRoom(key)).emit("share:ended", { reason });
    const ids = [...(namespace.adapter.rooms.get(publicRoom(key)) || [])];
    for (const id of ids) {
      const socket = namespace.sockets.get(id);
      if (socket) {
        socket.leave(publicRoom(key));
        delete socket.data.shareKey;
      }
    }
    clearTimeout(entry.timer);
    rooms.delete(key);
  }
  function fail(error, reply) {
    const status = [403, 404, 429].includes(error.status) ? error.status : 500;
    if (status === 500) console.error("Shared ride socket operation failed");
    const message =
      status === 404
        ? "Shared ride unavailable"
        : status === 403
          ? "Read-only shared ride connection"
          : status === 429
            ? "Too many shared ride attempts"
            : "Internal server error";
    reply({ success: false, error: { status, message } });
  }
  namespace.use((socket, next) => {
    try {
      take(
        socket.handshake.address,
        "connect",
        Math.min(features.RIDE_SHARE_RATE_LIMIT_MAX, 60),
      );
      next();
    } catch {
      const error = new Error("Too many shared ride attempts");
      error.data = { status: 429 };
      next(error);
    }
  });
  namespace.on("connection", (socket) => {
    let pending = Promise.resolve();
    function queue(work, reply) {
      // Charge before queuing: token guessing cannot build an unbounded work queue.
      try {
        take(
          socket.handshake.address,
          "join",
          Math.min(features.RIDE_SHARE_RATE_LIMIT_MAX, 30),
        );
      } catch (error) {
        fail(error, reply);
        return;
      }
      pending = pending.then(async () => {
        if (!socket.connected) return;
        try {
          await work();
        } catch (error) {
          detach(socket);
          fail(error, reply);
        }
      });
    }
    socket.on("share:join", (payload, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      queue(async () => {
        detach(socket);
        const parsed = joinInput.safeParse(payload);
        if (!parsed.success) throw unavailable();
        const { data, grant } = await sharedSnapshot(parsed.data.token);
        if (!socket.connected) throw unavailable();
        let entry = rooms.get(grant.key);
        if (!entry) {
          entry = {
            grant,
            lastLocationTimestamp: "",
            timer: setTimeout(
              () => end(grant.key, "expired"),
              Math.max(0, grant.expiresAt - Date.now()),
            ).unref(),
          };
          rooms.set(grant.key, entry);
        }
        socket.data.shareKey = grant.key;
        await socket.join(publicRoom(grant.key));
        await validateShareGrant(grant);
        if (
          !socket.connected ||
          socket.data.shareKey !== grant.key ||
          rooms.get(grant.key) !== entry ||
          Date.now() >= grant.expiresAt
        )
          throw unavailable();
        reply({ success: true, data });
      }, reply);
    });
    socket.on("share:leave", (payload, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      queue(async () => {
        detach(socket);
        reply({ success: true, data: { left: true } });
      }, reply);
    });
    socket.onAny((name, ...args) => {
      if (["share:join", "share:leave"].includes(name)) return;
      const acknowledge = args.at(-1);
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      try {
        take(
          socket.handshake.address,
          "forbidden",
          Math.min(features.RIDE_SHARE_RATE_LIMIT_MAX, 60),
        );
        throw new ApiError(403, "Read-only shared ride connection");
      } catch (error) {
        fail(error, reply);
      }
    });
    socket.on("disconnect", () => detach(socket));
  });
  async function broadcast(rideId, name, data, timestamp) {
    const entries = [...rooms.entries()].filter(
      ([, entry]) => entry.grant.rideId === String(rideId),
    );
    for (const [key, entry] of entries) {
      try {
        await validateShareGrant(entry.grant);
        if (rooms.get(key) !== entry) continue;
        if (Date.now() >= entry.grant.expiresAt) {
          end(key, "expired");
          continue;
        }
        if (name === "share:location") {
          if (timestamp < entry.lastLocationTimestamp) continue;
          entry.lastLocationTimestamp = timestamp;
        }
        namespace.to(publicRoom(key)).emit(name, data);
      } catch (error) {
        if (rooms.get(key) === entry)
          end(
            key,
            Date.now() >= entry.grant.expiresAt ? "expired" : "unavailable",
          );
        if (error.status !== 404) console.error("Shared ride broadcast failed");
      }
    }
  }
  const location = (payload) => {
    void broadcast(
      payload.rideId,
      "share:location",
      {
        latitude: payload.latitude,
        longitude: payload.longitude,
        updatedAt: payload.timestamp,
      },
      payload.timestamp,
    );
  };
  const status = (payload) => {
    if (!["completed", "cancelled"].includes(payload.status))
      void broadcast(payload.rideId, "share:ride-status", {
        rideStatus: payload.status,
        timestamp: payload.timestamp,
      });
  };
  const ended = (payload) => end(payload.key, payload.reason);
  trackingEvents.on("location", location);
  rideEvents.on("change", status);
  shareEvents.on("ended", ended);
  const cleanup = setInterval(() => {
    for (const [key, entry] of windows)
      if (Date.now() - entry.started >= 60000) windows.delete(key);
  }, 60000).unref();
  io.httpServer.once("close", () => {
    trackingEvents.off("location", location);
    rideEvents.off("change", status);
    shareEvents.off("ended", ended);
    clearInterval(cleanup);
    for (const entry of rooms.values()) clearTimeout(entry.timer);
    rooms.clear();
    windows.clear();
  });
  return namespace;
}
