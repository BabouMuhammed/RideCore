export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const requireThat = (condition, status, message) => {
  if (!condition) throw new ApiError(status, message);
};
export function errorHandler(error, req, res, next) {
  let status = error.status || 500;
  let message = error.message;
  if (error.code === 11000) {
    status = 409;
    message = "Resource already exists or an active ride conflicts";
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    status = 400;
    message = "Invalid resource data";
  }
  if (error.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON";
  }
  if (status >= 500) {
    console.error("API request failed with an internal server error");
    message = "Internal server error";
  }
  res.status(status).json({ success: false, error: { message } });
}
export const notFound = (req, res, next) =>
  next(new ApiError(404, "Endpoint not found"));
