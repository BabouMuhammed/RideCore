import webpush from "web-push";
import { AppSetting, PushSubscription } from "../models/index.js";

// Web Push notifications (lock-screen alerts on phones and desktops, also
// for an iPhone home-screen web app). The VAPID key pair identifies this
// server to push services. It comes from VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY
// when set, otherwise it is generated once and kept in the database, so a
// deployment needs no manual key setup and keys survive restarts.
let vapid;
export async function vapidKeys() {
  if (vapid) return vapid;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  } else {
    const fresh = webpush.generateVAPIDKeys();
    // $setOnInsert: concurrent first requests all end up with one pair.
    const stored = await AppSetting.findOneAndUpdate(
      { key: "vapid" },
      { $setOnInsert: { key: "vapid", value: fresh } },
      { upsert: true, returnDocument: "after" },
    );
    vapid = stored.value;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@ridecore.example",
    vapid.publicKey,
    vapid.privateKey,
  );
  return vapid;
}
export function resetVapidCache() {
  vapid = undefined;
}

export async function saveSubscription(user, { endpoint, keys }) {
  // A browser belongs to whoever signed in on it last.
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: user._id, endpoint, keys },
    { upsert: true },
  );
}
export async function removeSubscription(user, endpoint) {
  await PushSubscription.deleteOne({ endpoint, user: user._id });
}

// Fire-and-forget: a notification failing must never break the ride flow.
// Subscriptions the push service reports as gone are removed.
export async function notifyUsers(userIds, message) {
  try {
    if (!userIds.length) return 0;
    await vapidKeys();
    const subscriptions = await PushSubscription.find({
      user: { $in: userIds },
    }).lean();
    const payload = JSON.stringify(message);
    const results = await Promise.allSettled(
      subscriptions.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          payload,
          { TTL: 120, urgency: "high" },
        ),
      ),
    );
    const gone = subscriptions.filter((s, i) => {
      const status = results[i].reason?.statusCode;
      return (
        results[i].status === "rejected" && (status === 404 || status === 410)
      );
    });
    if (gone.length)
      await PushSubscription.deleteMany({
        endpoint: { $in: gone.map((s) => s.endpoint) },
      });
    return results.filter((r) => r.status === "fulfilled").length;
  } catch {
    return 0;
  }
}
