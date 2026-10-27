import { verifyIdentity } from "../services/identity.js";
import { ApiError } from "../utils/errors.js";
export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const { user } = await verifyIdentity(token, req.app.locals.jwtSecret);
  req.user = user;
  next();
}
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return next(new ApiError(403, "Access denied"));
    next();
  };
