import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
const schema = new Schema(
  {
    ride: { ...ref("Ride"), unique: true },
    rider: ref("User"),
    tokenHash: { type: String, required: true, unique: true, select: false },
    generation: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["active", "revoked", "ended"],
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endReason: { type: String, default: null },
    deleteAt: { type: Date, required: true },
  },
  {
    ...options,
    toJSON: {
      transform(doc, ret) {
        delete ret.tokenHash;
        delete ret.generation;
        delete ret.__v;
        return ret;
      },
    },
  },
);
schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
export const RideShare = model("RideShare", schema);
