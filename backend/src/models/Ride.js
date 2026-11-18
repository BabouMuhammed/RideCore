import { Schema, model } from "mongoose";
import { ref, options, pointSchema } from "./shared.js";
const stop = new Schema(
  {
    address: { type: String, required: true },
    location: { type: pointSchema, required: true },
  },
  { _id: false },
);
const trackingSample = new Schema(
  {
    location: { type: pointSchema, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
);
const rideSchema = new Schema(
  {
    trackingLocation: { type: trackingSample, default: undefined },
    // No read default: historical missing-currency records remain legacy GBP.
    currency: { type: String, enum: ["GMD", "GBP"] },
    rider: ref("User"),
    driver: ref("User", false),
    pickup: stop,
    destination: stop,
    distance: Number,
    estimatedDuration: Number,
    estimatedFare: Number,
    finalFare: Number,
    vehicleType: { type: String, enum: ["economy", "comfort", "xl"] },
    status: {
      type: String,
      enum: [
        "requested",
        "accepted",
        "driver_arriving",
        "driver_arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "requested",
    },
    active: { type: Boolean, default: true },
    requestedAt: { type: Date, default: Date.now },
    requestExpiresAt: Date,
    acceptedAt: Date,
    arrivingAt: Date,
    arrivedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
  },
  options,
);
rideSchema.index(
  { rider: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
rideSchema.index(
  { driver: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true, driver: { $type: "objectId" } },
  },
);
rideSchema.index({ "pickup.location": "2dsphere" });
export const Ride = model("Ride", rideSchema);
