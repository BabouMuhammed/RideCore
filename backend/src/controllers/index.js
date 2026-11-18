import { rideDetail } from "../services/ride-detail.js";
import * as otp from "../services/otp.js";
import * as auth from "../services/auth.js";
import * as drivers from "../services/drivers.js";
import * as rides from "../services/rides.js";
import * as payments from "../services/payments.js";
import * as admin from "../services/admin.js";
import { estimateFare } from "../services/pricing.js";
import { DriverProfile, Vehicle, Ride, Payment } from "../models/index.js";
import { requireThat } from "../utils/errors.js";
const send = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
export const adminOverview = async (req, res) =>
  send(res, await admin.overview());
export const register = async (req, res) =>
  send(res, await auth.register(req.input), 201);
export const login = async (req, res) =>
  send(res, await auth.login(req.input, req.app.locals.jwtSecret));
export const me = (req, res) => send(res, req.user);
export const profile = async (req, res) =>
  send(res, {
    profile: await DriverProfile.findOne({ user: req.user._id }),
    vehicle: await Vehicle.findOne({ driver: req.user._id }),
  });
export const updateProfile = async (req, res) =>
  send(res, await drivers.updateProfile(req.user, req.input));
export const updateVehicle = async (req, res) =>
  send(res, await drivers.updateVehicle(req.user, req.input));
export const location = async (req, res) =>
  send(res, await drivers.setLocation(req.user, req.input));
export const availability = async (req, res) =>
  send(
    res,
    await drivers.setAvailability(req.user, req.input.availabilityStatus),
  );
export const estimate = (req, res) => send(res, estimateFare(req.input));
export const createRide = async (req, res) =>
  send(
    res,
    await rides.createRide(
      req.user,
      req.input,
      req.app.locals.features.RIDE_REQUEST_TIMEOUT_SECONDS,
    ),
    201,
  );
export const myRides = async (req, res) =>
  send(
    res,
    await Ride.find({
      [req.user.role === "driver" ? "driver" : "rider"]: req.user._id,
    })
      .sort({ requestedAt: -1 })
      .limit(50),
  );
export const getRide = async (req, res) =>
  send(res, await rideDetail(req.params.id, req.user));
export const requests = async (req, res) =>
  send(
    res,
    await rides.rideRequests(
      req.user,
      req.app.locals.features.DRIVER_SEARCH_RADIUS_KM,
    ),
  );
export const accept = async (req, res) =>
  send(
    res,
    await rides.acceptRide(
      req.params.id,
      req.user,
      req.app.locals.features.DRIVER_SEARCH_RADIUS_KM,
    ),
  );
export const progress = (action) => async (req, res) =>
  send(res, await rides.progressRide(req.params.id, req.user, action));
export const cancel = async (req, res) =>
  send(res, await rides.cancelRide(req.params.id, req.user, req.input.reason));
export const pay = async (req, res) =>
  send(res, await payments.payRide(req.params.id, req.user, req.input.method));
export const payment = async (req, res) => {
  await rides.getRide(req.params.id, req.user);
  const payment = await Payment.findOne({ ride: req.params.id });
  requireThat(payment, 404, "Payment not found");
  send(res, payment);
};
export const rate = async (req, res) =>
  send(res, await payments.rateRide(req.params.id, req.user, req.input), 201);
export const list = (kind) => async (req, res) =>
  send(res, await admin.listResources(kind, req.query.page));
export const verify = (kind) => async (req, res) =>
  send(
    res,
    await admin.verifyResource(
      kind,
      req.params.id,
      req.input.verificationStatus,
    ),
  );
export const active = async (req, res) =>
  send(
    res,
    await admin.setUserActive(req.params.id, req.user, req.input.isActive),
  );

export const nearby = async (req, res) =>
  send(
    res,
    await drivers.nearbyDrivers(
      [req.queryInput.lng, req.queryInput.lat],
      req.app.locals.features.DRIVER_SEARCH_RADIUS_KM,
    ),
  );

const otpOptions = (req) => ({
  secret: req.app.locals.jwtSecret,
  settings: req.app.locals.features,
  runtimeMode: req.app.locals.runtimeMode,
});
export const requestOtp = async (req, res) =>
  send(res, await otp.requestPhoneOtp(req.user._id, otpOptions(req)));
export const verifyOtp = async (req, res) =>
  send(
    res,
    await otp.verifyPhoneOtp(req.user._id, req.input.code, otpOptions(req)),
  );
