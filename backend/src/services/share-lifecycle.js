import { RideShare } from "../models/index.js";
import { shareKey } from "../realtime/share-events.js";
export async function endRideShares(rideId, reason, session) {
  const share = await RideShare.findOne({ ride: rideId, status: "active" })
    .select("+generation")
    .session(session);
  if (!share) return [];
  share.status = "ended";
  share.endedAt = new Date();
  share.endReason = reason;
  await share.save({ session });
  return [shareKey(share)];
}
