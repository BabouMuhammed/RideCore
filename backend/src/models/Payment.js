import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
export const Payment = model(
  "Payment",
  new Schema(
    {
      ride: { ...ref("Ride"), unique: true },
      rider: ref("User"),
      driver: ref("User"),
      currency: { type: String, enum: ["GMD", "GBP"] },
      amount: { type: Number, min: 0, required: true },
      method: { type: String, enum: ["cash", "mock_wallet"], required: true },
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
      },
      transactionReference: { type: String, unique: true, required: true },
      paidAt: Date,
    },
    options,
  ),
);
