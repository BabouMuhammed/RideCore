import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
export const Vehicle = model(
  "Vehicle",
  new Schema(
    {
      driver: { ...ref("User"), unique: true },
      make: { type: String, required: true },
      model: { type: String, required: true },
      year: { type: Number, required: true },
      color: { type: String, required: true },
      plateNumber: { type: String, required: true, unique: true },
      vehicleType: {
        type: String,
        enum: ["economy", "comfort", "xl"],
        required: true,
      },
      seats: { type: Number, required: true, min: 1, max: 12 },
      verificationStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", "suspended"],
        default: "pending",
      },
    },
    options,
  ),
);
