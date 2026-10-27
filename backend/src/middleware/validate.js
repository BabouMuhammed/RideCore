import { z } from "zod";
import { ApiError } from "../utils/errors.js";
export const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid resource ID");
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success)
    return next(
      new ApiError(
        400,
        result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      ),
    );
  req.input = result.data;
  next();
};
export const validateId = (req, res, next) => {
  if (!objectId.safeParse(req.params.id).success)
    return next(new ApiError(400, "Invalid resource ID"));
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success)
    return next(new ApiError(400, "Invalid query parameters"));
  req.queryInput = parsed.data;
  next();
};
