import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Payment, Rating, DriverProfile } from "../models/index.js";
import { getRide } from "./rides.js";
import { requireThat } from "../utils/errors.js";
export async function payRide(id, user, method) {
  const ride = await getRide(id, user);
  requireThat(
    String(ride.rider) === String(user._id),
    403,
    "Only the rider can record payment",
  );
  requireThat(
    ride.status === "completed",
    409,
    "Payment requires a completed ride",
  );
  const existing = await Payment.findOne({ ride: id });
  if (existing) {
    requireThat(
      existing.method === method,
      409,
      "Payment already recorded with another method",
    );
    return existing;
  }
  try {
    return await Payment.create({
      ride: id,
      rider: ride.rider,
      driver: ride.driver,
      amount: ride.finalFare,
      currency: ride.currency || "GBP",
      method,
      status: "paid",
      transactionReference: `SIM-${randomUUID()}`,
      paidAt: new Date(),
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const payment = await Payment.findOne({ ride: id });
    requireThat(payment && payment.method === method, 409, "Payment conflict");
    return payment;
  }
}
export async function rateRide(id, user, input) {
  return mongoose.connection.transaction(async (session) => {
    const ride = await getRide(id, user, session);
    requireThat(
      ride.status === "completed",
      409,
      "Rating requires a completed ride",
    );
    const isRider = String(ride.rider) === String(user._id);
    requireThat(
      isRider || String(ride.driver) === String(user._id),
      403,
      "Only ride participants may rate",
    );
    const reviewee = isRider ? ride.driver : ride.rider;
    const [rating] = await Rating.create(
      [{ ...input, ride: id, reviewer: user._id, reviewee }],
      { session },
    );
    if (isRider) {
      await DriverProfile.updateOne(
        { user: reviewee },
        [
          {
            $set: {
              ratingCount: { $add: ["$ratingCount", 1] },
              ratingTotal: { $add: ["$ratingTotal", input.rating] },
            },
          },
          {
            $set: {
              ratingAverage: { $divide: ["$ratingTotal", "$ratingCount"] },
            },
          },
        ],
        { session, updatePipeline: true },
      );
    }
    return rating;
  });
}
