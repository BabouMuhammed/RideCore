import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, DriverProfile } from "../models/index.js";
import { ApiError } from "../utils/errors.js";
import { registration } from "../routes/schemas.js";
export async function register(input) {
  // Validate here too: internal callers must not bypass the HTTP field policy.
  const data = registration.parse(input);
  const password = await bcrypt.hash(data.password, 12);
  return mongoose.connection.transaction(async (session) => {
    const [user] = await User.create(
      [
        {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          password,
          role: data.accountType === "driver" ? "driver" : "rider",
        },
      ],
      { session },
    );
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
