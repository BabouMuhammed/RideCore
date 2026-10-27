import { Schema, model } from "mongoose";
import { ref, options, pointSchema } from "./shared.js";
const driverSchema = new Schema(
  {
    user: { ...ref("User"), unique: true },
    licenseNumber: { type: String, unique: true, sparse: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    availabilityStatus: {
      type: String,
      enum: ["offline", "online", "busy"],
      default: "offline",
    },
    currentLocation: { type: pointSchema, default: undefined },
    locationPersistedAt: Date,
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    ratingTotal: { type: Number, default: 0 },
  },
  options,
);
driverSchema.index({ currentLocation: "2dsphere" });
export const DriverProfile = model("DriverProfile", driverSchema);
