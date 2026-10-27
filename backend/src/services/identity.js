import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { objectId } from "../middleware/validate.js";
import { ApiError } from "../utils/errors.js";
export async function verifyIdentity(token, secret) {
  let payload;
  try {
    payload = jwt.verify(token || "", secret, {
      algorithms: ["HS256"],
      issuer: "ride-core",
      audience: "ride-core-api",
    });
  } catch {
    throw new ApiError(401, "Authentication required");
  }
  if (!objectId.safeParse(payload.sub).success)
    throw new ApiError(401, "Authentication required");
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive)
    throw new ApiError(401, "Authentication required");
  return {
    user,
    expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : null,
  };
}
