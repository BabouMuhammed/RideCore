import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, DriverProfile } from "../models/index.js";
import { ApiError } from "../utils/errors.js";
export async function register(input) {
  const password = await bcrypt.hash(input.password, 12);
  return mongoose.connection.transaction(async (session) => {
    const [user] = await User.create([{ ...input, password }], { session });
    if (user.role === "driver")
      await DriverProfile.create([{ user: user._id }], { session });
    return user;
  });
}
export async function login(input, secret) {
  const user = await User.findOne(
    input.email ? { email: input.email } : { phone: input.phone },
  ).select("+password");
  // Compare a fixed valid hash even for unknown accounts to reduce timing differences.
  const valid = await bcrypt.compare(
    input.password,
    user?.password ||
      "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
  );
  if (!valid || !user?.isActive)
    throw new ApiError(401, "Invalid email or password");
  return {
    user,
    token: jwt.sign({}, secret, {
      subject: String(user._id),
      expiresIn: "2h",
      algorithm: "HS256",
      issuer: "ride-core",
      audience: "ride-core-api",
    }),
  };
}
