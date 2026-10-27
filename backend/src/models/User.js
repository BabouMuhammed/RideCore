import { Schema, model } from "mongoose";
import { ref, options } from "./shared.js";
const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["rider", "driver", "admin"],
      default: "rider",
    },
    profileImage: String,
    isActive: { type: Boolean, default: true },
    phoneVerifiedAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
  },
  options,
);
export const User = model("User", userSchema);
