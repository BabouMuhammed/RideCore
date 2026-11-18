import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
// A browser or phone that asked for RideCore notifications (Web Push).
const schema = new Schema(
  {
    user: { ...ref("User"), index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  options,
);
export const PushSubscription = model("PushSubscription", schema);
