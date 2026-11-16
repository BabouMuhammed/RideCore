import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { registration } from "../src/routes/schemas.js";
import { User } from "../src/models/index.js";
import { connectDatabase } from "../src/config/db.js";
import { readEnvironment } from "../src/config/env.js";
try {
  const env = readEnvironment();
  const input = registration.safeParse({
    firstName: process.env.ADMIN_FIRST_NAME || "Ride",
    lastName: process.env.ADMIN_LAST_NAME || "Administrator",
    email: process.env.ADMIN_EMAIL,
    phone: process.env.ADMIN_PHONE,
    password: process.env.ADMIN_PASSWORD,
  });
  if (!input.success) throw new Error("Invalid admin input");
  await connectDatabase(env.MONGODB_URI);
  await User.init();
  const password = await bcrypt.hash(input.data.password, 12);
  await User.create({
    firstName: input.data.firstName,
    lastName: input.data.lastName,
    email: input.data.email,
    phone: input.data.phone,
    password,
    role: "admin",
    isVerified: true,
  });
  console.log("Admin created. Sign in through /api/auth/login.");
} catch {
  console.error(
    "Admin creation failed. Check configuration, required admin environment variables, and duplicate accounts.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
