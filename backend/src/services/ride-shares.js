import mongoose from "mongoose";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { Ride, RideShare, User } from "../models/index.js";
import { ApiError, requireThat } from "../utils/errors.js";
import { trackableStates } from "./tracking.js";
import { shareKey, publishShareEnded } from "../realtime/share-events.js";
export const shareToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const unavailable = () => new ApiError(404, "Shared ride unavailable");
export const hashShareToken = (token) =>
  createHash("sha256").update(token).digest("hex");
async function ownRide(id, user, session) {
  requireThat(user.role === "rider", 403, "Owning rider required");
  const activeUser = await User.findOneAndUpdate(
    { _id: user._id, role: "rider", isActive: true },
    { $inc: { __v: 1 } },
    { session },
  );
  requireThat(activeUser, 401, "Authentication required");
  const ride = await Ride.findById(id).session(session);
  requireThat(ride, 404, "Ride not found");
  requireThat(ride.rider.equals(user._id), 403, "Owning rider required");
  // Serialize sharing against completion/cancellation and other sharing mutations.
  await Ride.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session });
  return ride;
}
export async function createRideShare(id, user, ttlSeconds) {
  const token = randomBytes(32).toString("base64url");
  const result = await mongoose.connection.transaction(async (session) => {
    const ride = await ownRide(id, user, session);
    requireThat(
      ride.active && ride.driver && trackableStates.includes(ride.status),
      409,
      "Ride is not shareable",
    );
    const now = new Date();
    let share = await RideShare.findOne({ ride: id })
      .select("+generation")
      .session(session);
    requireThat(
      !share || share.status !== "active" || share.expiresAt <= now,
      409,
      "Revoke the existing share before creating another",
    );
    const expiredKey = share?.status === "active" ? shareKey(share) : null;
    if (!share) share = new RideShare({ ride: id, rider: user._id });
    Object.assign(share, {
      tokenHash: hashShareToken(token),
      generation: randomBytes(16).toString("hex"),
      status: "active",
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      revokedAt: null,
      endedAt: null,
      endReason: null,
      deleteAt: new Date(now.getTime() + ttlSeconds * 1000 + 86400000),
    });
    await share.save({ session });
    return { expiresAt: share.expiresAt, expiredKey };
  });
  if (result.expiredKey) publishShareEnded(result.expiredKey, "expired");
  return { token, sharePath: `/track/${token}`, expiresAt: result.expiresAt };
}
export async function revokeRideShare(id, user) {
  const key = await mongoose.connection.transaction(async (session) => {
    await ownRide(id, user, session);
    const share = await RideShare.findOne({ ride: id, status: "active" })
      .select("+generation")
      .session(session);
    if (!share) return null;
    share.status = "revoked";
    share.revokedAt = new Date();
    share.endReason = "revoked";
    await share.save({ session });
    return shareKey(share);
  });
  if (key) publishShareEnded(key, "revoked");
  return { revoked: true };
}
export async function validateShareGrant(grant) {
  const share = await RideShare.findOne({
    _id: grant.shareId,
    tokenHash: grant.tokenHash,
    generation: grant.generation,
    status: "active",
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!share) throw unavailable();
  const ride = await Ride.findOne({
    _id: share.ride,
    rider: share.rider,
    driver: { $type: "objectId" },
    status: { $in: trackableStates },
    active: true,
  });
  if (!ride || share.expiresAt.getTime() <= Date.now()) throw unavailable();
  return { share, ride };
}
export async function resolveShareToken(token) {
  if (!shareToken.safeParse(token).success) throw unavailable();
  const tokenHash = hashShareToken(token);
  const share = await RideShare.findOne({
    tokenHash,
    status: "active",
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("+generation");
  if (!share) throw unavailable();
  const grant = {
    shareId: String(share._id),
    rideId: String(share.ride),
    tokenHash,
    generation: share.generation,
    expiresAt: share.expiresAt.getTime(),
    key: shareKey(share),
  };
  const access = await validateShareGrant(grant);
  return { ...access, grant };
}
