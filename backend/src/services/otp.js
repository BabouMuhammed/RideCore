import mongoose from "mongoose";
import {
  randomInt,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { User, PhoneOtp } from "../models/index.js";
import { requireThat } from "../utils/errors.js";
import { deliverPhoneOtp } from "./otp-delivery.js";
const windowMs = 15 * 60 * 1000;
const failureMessage = "Invalid or expired verification code";
export function hashPhoneOtp(code, user, phone, nonce, secret) {
  return createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "ride-core-phone-otp-v1",
        String(user),
        phone,
        nonce,
        code,
      ]),
    )
    .digest("hex");
}
export async function requestPhoneOtp(
  userId,
  { secret, settings, runtimeMode },
) {
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const nonce = randomBytes(24).toString("hex");
  const generated = await mongoose.connection.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true },
      { $inc: { __v: 1 } },
      { session, returnDocument: "after" },
    );
    requireThat(user, 401, "Authentication required");
    if (user.phoneVerifiedAt) return false;
    const now = new Date();
    let otp = await PhoneOtp.findOne({ user: userId })
      .select("+codeHash +nonce +phone")
      .session(session);
    if (otp) {
      requireThat(
        now - otp.requestedAt >= settings.OTP_RESEND_COOLDOWN_SECONDS * 1000,
        429,
        "Please wait before requesting another code",
      );
      if (now - otp.windowStartedAt >= windowMs) {
        otp.windowStartedAt = now;
        otp.requestCount = 0;
      }
      requireThat(otp.requestCount < 5, 429, "Too many verification requests");
    } else
      otp = new PhoneOtp({
        user: userId,
        windowStartedAt: now,
        requestCount: 0,
      });
    Object.assign(otp, {
      phone: user.phone,
      codeHash: hashPhoneOtp(code, userId, user.phone, nonce, secret),
      nonce,
      requestedAt: now,
      expiresAt: new Date(now.getTime() + settings.OTP_TTL_SECONDS * 1000),
      attempts: 0,
      consumedAt: null,
      deleteAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
    otp.requestCount += 1;
    await otp.save({ session });
    return true;
  });
  const delivery = generated
    ? await deliverPhoneOtp({ code, runtimeMode })
    : {};
  return {
    message: "If verification is needed, a mock code has been generated",
    expiresInSeconds: settings.OTP_TTL_SECONDS,
    ...delivery,
  };
}
export async function verifyPhoneOtp(userId, code, { secret, settings }) {
  const valid = await mongoose.connection.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true },
      { $inc: { __v: 1 } },
      { session, returnDocument: "after" },
    );
    requireThat(user, 401, "Authentication required");
    const otp = await PhoneOtp.findOne({ user: userId })
      .select("+codeHash +nonce +phone")
      .session(session);
    if (
      !otp ||
      otp.consumedAt ||
      otp.expiresAt <= new Date() ||
      otp.attempts >= settings.OTP_MAX_ATTEMPTS ||
      otp.phone !== user.phone ||
      user.phoneVerifiedAt
    )
      return false;
    const expected = Buffer.from(otp.codeHash, "hex");
    const supplied = Buffer.from(
      hashPhoneOtp(code, userId, user.phone, otp.nonce, secret),
      "hex",
    );
    otp.attempts += 1;
    const matches =
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied);
    if (matches) {
      otp.consumedAt = new Date();
      user.phoneVerifiedAt = otp.consumedAt;
      await user.save({ session });
    }
    await otp.save({ session });
    // Return failures so attempts commit; throwing here would roll back the counter.
    return matches;
  });
  requireThat(valid, 400, failureMessage);
  return { message: "Phone verified" };
}
