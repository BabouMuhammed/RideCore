import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
const ratingSchema = new Schema(
  {
    ride: ref("Ride"),
    reviewer: ref("User"),
    reviewee: ref("User"),
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
  },
  options,
);
ratingSchema.index({ ride: 1, reviewer: 1 }, { unique: true });
export const Rating = model("Rating", ratingSchema);
