import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
const schema = new Schema(
  {
    user: { ...ref("User"), unique: true },
    phone: { type: String, required: true, select: false },
    codeHash: { type: String, required: true, select: false },
    nonce: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    requestedAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    windowStartedAt: { type: Date, required: true },
    requestCount: { type: Number, default: 1 },
    deleteAt: { type: Date, required: true },
  },
  options,
);
// Retain abuse counters beyond code expiry; expiry is checked explicitly in services.
schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
export const PhoneOtp = model("PhoneOtp", schema);
