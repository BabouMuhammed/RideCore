import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  setup,
  reset,
  cleanup,
  api,
  actors,
  secret,
  password,
} from "./helpers.js";
import { PhoneOtp, User } from "../src/models/index.js";
import { createApp } from "../src/app.js";
import { readFeatureSettings } from "../src/config/features.js";
import { deliverPhoneOtp } from "../src/services/otp-delivery.js";
beforeAll(setup);
beforeEach(reset);
afterAll(cleanup);
const requestCode = () => api("rider", "post", "/api/auth/otp/request", {});
const verifyCode = (code) =>
  api("rider", "post", "/api/auth/otp/verify", { code });
const wrongCode = (code) => (code === "000000" ? "111111" : "000000");
const freshApp = (runtimeMode) =>
  createApp({
    jwtSecret: secret,
    runtimeMode,
    features: readFeatureSettings({}),
    logging: false,
  });
const isolated = (app, path, body) =>
  request(app)
    .post(path)
    .set("Authorization", `Bearer ${actors.rider.token}`)
    .send(body);
describe("mock OTP phone verification", () => {
  it("requests a six-digit code and stores only keyed hashes, not plaintext codes", async () => {
    const response = await requestCode();
    expect(response.status).toBe(200);
    expect(response.body.data.mockCode).toMatch(/^\d{6}$/);
    const stored = await PhoneOtp.findOne({
      user: actors.rider.user._id,
    }).select("+codeHash +nonce +phone");
    expect(stored.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.codeHash).not.toBe(response.body.data.mockCode);
    expect(stored.toObject()).not.toHaveProperty("code");
    expect(stored.nonce).toHaveLength(48);
    expect((await PhoneOtp.findById(stored._id)).codeHash).toBeUndefined();
    expect(stored.expiresAt.getTime() - stored.requestedAt.getTime()).toBe(
      300000,
    );
  });
  it("verifies the phone and exposes its timestamp through auth/me", async () => {
    expect(
      (await api("rider", "get", "/api/auth/me")).body.data.phoneVerifiedAt,
    ).toBeNull();
    const code = (await requestCode()).body.data.mockCode;
    expect((await verifyCode(code)).status).toBe(200);
    const me = await api("rider", "get", "/api/auth/me");
    expect(Number.isNaN(Date.parse(me.body.data.phoneVerifiedAt))).toBe(false);
    expect(me.body.data.isVerified).toBe(false);
  });
  it("rejects incorrect codes and commits the failed attempt", async () => {
    const code = (await requestCode()).body.data.mockCode;
    expect((await verifyCode(wrongCode(code))).status).toBe(400);
    expect(
      (await PhoneOtp.findOne({ user: actors.rider.user._id })).attempts,
    ).toBe(1);
    expect(
      (await User.findById(actors.rider.user._id)).phoneVerifiedAt,
    ).toBeNull();
  });
  it("rejects expired codes even before TTL cleanup", async () => {
    const code = (await requestCode()).body.data.mockCode;
    await PhoneOtp.updateOne(
      { user: actors.rider.user._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    expect((await verifyCode(code)).status).toBe(400);
  });
  it("rejects code reuse", async () => {
    const code = (await requestCode()).body.data.mockCode;
    expect((await verifyCode(code)).status).toBe(200);
    expect((await verifyCode(code)).status).toBe(400);
  });
  it("consumes a code only once during concurrent verification", async () => {
    const code = (await requestCode()).body.data.mockCode;
    const responses = await Promise.all([verifyCode(code), verifyCode(code)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
  });
  it("locks the challenge after the maximum failed attempts", async () => {
    const code = (await requestCode()).body.data.mockCode;
    for (let i = 0; i < 5; i++)
      expect((await verifyCode(wrongCode(code))).status).toBe(400);
    expect((await verifyCode(code)).status).toBe(400);
    expect(
      (await PhoneOtp.findOne({ user: actors.rider.user._id })).attempts,
    ).toBe(5);
  });
  it("enforces resend cooldown", async () => {
    expect((await requestCode()).status).toBe(200);
    const repeated = await requestCode();
    expect(repeated.status).toBe(429);
    expect(repeated.body.data).toBeUndefined();
  });
  it("allows resend after cooldown with a replaced challenge", async () => {
    await requestCode();
    const before = await PhoneOtp.findOne({
      user: actors.rider.user._id,
    }).select("+nonce");
    await PhoneOtp.updateOne(
      { _id: before._id },
      { requestedAt: new Date(Date.now() - 61000) },
    );
    const replacement = await requestCode();
    expect(replacement.status).toBe(200);
    const after = await PhoneOtp.findById(before._id).select("+nonce");
    expect(after.nonce).not.toBe(before.nonce);
    expect((await verifyCode(replacement.body.data.mockCode)).status).toBe(200);
  });
  it("keeps per-account request limits across fresh HTTP rate limiter instances", async () => {
    for (let i = 0; i < 5; i++) {
      await PhoneOtp.updateOne(
        { user: actors.rider.user._id },
        { requestedAt: new Date(Date.now() - 61000) },
      );
      expect(
        (await isolated(freshApp("test"), "/api/auth/otp/request", {})).status,
      ).toBe(200);
    }
    await PhoneOtp.updateOne(
      { user: actors.rider.user._id },
      { requestedAt: new Date(Date.now() - 61000) },
    );
    const limited = await isolated(
      freshApp("test"),
      "/api/auth/otp/request",
      {},
    );
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Too many verification requests");
  });
  it("keeps request HTTP rate limiting active", async () => {
    let response;
    for (let i = 0; i < 6; i++) response = await requestCode();
    expect(response.status).toBe(429);
    expect(response.body.error.message).toBe("Too many verification attempts");
  });
  it("keeps verification HTTP rate limiting active", async () => {
    await requestCode();
    let response;
    for (let i = 0; i < 16; i++) response = await verifyCode("000000");
    expect(response.status).toBe(429);
    expect(response.body.error.message).toBe("Too many verification attempts");
  });
  it.each(["development", "test"])(
    "supports code retrieval only in %s mode",
    async (runtimeMode) => {
      const response = await isolated(
        freshApp(runtimeMode),
        "/api/auth/otp/request",
        {},
      );
      expect(response.status).toBe(200);
      expect(response.body.data.mockCode).toMatch(/^\d{6}$/);
    },
  );
  it("never exposes a mock OTP in a production response", async () => {
    const response = await isolated(
      freshApp("production"),
      "/api/auth/otp/request",
      {},
    );
    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty("mockCode");
    expect(Object.keys(response.body.data).sort()).toEqual([
      "expiresInSeconds",
      "message",
    ]);
    expect(
      await deliverPhoneOtp({ code: "123456", runtimeMode: "production" }),
    ).toEqual({});
    expect(
      await deliverPhoneOtp({ code: "123456", runtimeMode: "unknown" }),
    ).toEqual({});
  });
  it("requires authentication and only accepts the current account phone", async () => {
    expect((await api(null, "post", "/api/auth/otp/request", {})).status).toBe(
      401,
    );
    expect(
      (
        await api("rider", "post", "/api/auth/otp/request", {
          phone: "+447700999999",
        })
      ).status,
    ).toBe(400);
    expect((await verifyCode("123")).status).toBe(400);
  });
  it("does not issue another code for an already verified phone", async () => {
    const code = (await requestCode()).body.data.mockCode;
    await verifyCode(code);
    const response = await requestCode();
    expect(response.status).toBe(200);
    expect(response.body.data.mockCode).toBeUndefined();
  });
  it("allows normalized phone/password login without changing email login", async () => {
    const response = await api(null, "post", "/api/auth/login", {
      phone: actors.rider.user.phone,
      password,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(
      (
        await api(null, "post", "/api/auth/login", {
          phone: actors.rider.user.phone,
          email: actors.rider.user.email,
          password,
        })
      ).status,
    ).toBe(400);
  });
});
