import * as sharing from "../controllers/ride-shares.js";
import { sharedRideRoutes } from "./shared-rides.js";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate, validateId, validateQuery } from "../middleware/validate.js";
import * as s from "./schemas.js";
import * as c from "../controllers/index.js";
export function apiRoutes(features) {
  const api = Router();
  api.use(
    "/shared-rides",
    sharedRideRoutes(features.RIDE_SHARE_RATE_LIMIT_MAX),
  );
  const auth = Router();
  auth.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: { message: "Too many authentication attempts" },
      },
    }),
  );
  auth.post("/register", validate(s.registration), c.register);
  auth.post("/login", validate(s.credentials), c.login);
  auth.get("/me", authenticate, c.me);
  const otpLimit = (limit) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: { message: "Too many verification attempts" },
      },
    });
  auth.post(
    "/otp/request",
    otpLimit(5),
    authenticate,
    validate(s.otpRequest),
    c.requestOtp,
  );
  auth.post(
    "/otp/verify",
    otpLimit(15),
    authenticate,
    validate(s.otpVerification),
    c.verifyOtp,
  );

  api.use("/auth", auth);
  const drivers = Router();
  drivers.get(
    "/nearby",
    authenticate,
    authorize("rider"),
    validateQuery(s.nearbyQuery),
    c.nearby,
  );
  drivers.use(authenticate, authorize("driver"));
  drivers.get("/me", c.profile);
  drivers.put("/profile", validate(s.licenseInput), c.updateProfile);
  drivers.put("/vehicle", validate(s.vehicleInput), c.updateVehicle);
  drivers.patch("/location", validate(s.point), c.location);
  drivers.patch("/availability", validate(s.availability), c.availability);
  drivers.get("/ride-requests", c.requests);
  api.use("/drivers", drivers);
  const rides = Router();
  rides.use(authenticate);
  rides.post("/estimate", validate(s.rideInput), c.estimate);
  rides.post("/", authorize("rider"), validate(s.rideInput), c.createRide);
  rides.get("/me", c.myRides);
  rides.use("/:id", validateId);
  rides.get("/:id", c.getRide);
  rides.post(
    "/:id/share",
    authorize("rider"),
    sharing.shareHeaders,
    validate(s.shareCreation),
    sharing.create,
  );
  rides.delete(
    "/:id/share",
    authorize("rider"),
    sharing.shareHeaders,
    sharing.revoke,
  );
  rides.patch("/:id/accept", authorize("driver"), c.accept);
  for (const action of ["arriving", "arrived", "start", "complete"])
    rides.patch(`/:id/${action}`, authorize("driver"), c.progress(action));
  rides.patch("/:id/cancel", validate(s.cancellation), c.cancel);
  rides.post(
    "/:id/payment",
    authorize("rider"),
    validate(s.paymentInput),
    c.pay,
  );
  rides.get("/:id/payment", c.payment);
  rides.post(
    "/:id/ratings",
    authorize("rider", "driver"),
    validate(s.ratingInput),
    c.rate,
  );
  api.use("/rides", rides);
  const admin = Router();
  admin.use(authenticate, authorize("admin"));
  admin.get("/overview", c.adminOverview);
  for (const kind of ["users", "drivers", "rides", "payments"])
    admin.get(`/${kind}`, c.list(kind));
  for (const kind of ["drivers", "vehicles"])
    admin.patch(
      `/${kind}/:id/verification`,
      validateId,
      validate(s.verification),
      c.verify(kind),
    );
  admin.patch(
    "/users/:id/active",
    validateId,
    validate(s.activeInput),
    c.active,
  );
  api.use("/admin", admin);
  // Lock-screen notifications (Web Push).
  const pushRoutes = Router();
  pushRoutes.get("/public-key", c.pushPublicKey);
  pushRoutes.post(
    "/subscriptions",
    authenticate,
    validate(s.pushSubscription),
    c.pushSubscribe,
  );
  pushRoutes.delete(
    "/subscriptions",
    authenticate,
    validate(s.pushUnsubscribe),
    c.pushUnsubscribe,
  );
  api.use("/push", pushRoutes);
  return api;
}
