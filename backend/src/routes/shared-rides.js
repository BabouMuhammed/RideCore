import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { shareHeaders, snapshot } from "../controllers/ride-shares.js";
export function sharedRideRoutes(limit) {
  const router = Router();
  router.use(shareHeaders);
  router.use(
    rateLimit({
      windowMs: 60000,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: { message: "Too many shared ride requests" },
      },
    }),
  );
  router.get("/:token", snapshot);
  router.use((req, res) =>
    res
      .status(404)
      .json({ success: false, error: { message: "Shared ride unavailable" } }),
  );
  router.use((error, req, res, next) => {
    // Decode errors can contain the raw URL parameter. Never echo it back.
    const status =
      error.status === 404 || error instanceof URIError ? 404 : 500;
    if (status === 500) console.error("Shared ride snapshot failed");
    res.status(status).json({
      success: false,
      error: {
        message:
          status === 404 ? "Shared ride unavailable" : "Internal server error",
      },
    });
  });
  return router;
}
