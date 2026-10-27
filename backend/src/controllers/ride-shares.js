import { createRideShare, revokeRideShare } from "../services/ride-shares.js";
import { sharedSnapshot } from "../services/share-snapshot.js";
export const shareHeaders = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  });
  next();
};
export const create = async (req, res) =>
  res.status(201).json({
    success: true,
    data: await createRideShare(
      req.params.id,
      req.user,
      req.app.locals.features.RIDE_SHARE_TTL_SECONDS,
    ),
  });
export const revoke = async (req, res) =>
  res.json({
    success: true,
    data: await revokeRideShare(req.params.id, req.user),
  });
export const snapshot = async (req, res) =>
  res.json({
    success: true,
    data: (await sharedSnapshot(req.params.token)).data,
  });
