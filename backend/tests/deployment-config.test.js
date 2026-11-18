import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { parseOrigins, readEnvironment } from "../src/config/env.js";
import { readFeatureSettings } from "../src/config/features.js";
import { deliverPhoneOtp } from "../src/services/otp-delivery.js";

const base = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/test",
  JWT_SECRET: "x".repeat(40),
};

describe("deployment configuration", () => {
  it("accepts several comma-separated CORS origins", () => {
    expect(
      parseOrigins(" https://a.example/, http://192.168.0.5:8081 "),
    ).toEqual(["https://a.example", "http://192.168.0.5:8081"]);
    const env = readEnvironment({
      ...base,
      CORS_ORIGIN: "https://ridecore.vercel.app,http://localhost:8081",
    });
    expect(parseOrigins(env.CORS_ORIGIN)).toHaveLength(2);
  });

  it("rejects a CORS value that is not a URL", () => {
    expect(() =>
      readEnvironment({ ...base, CORS_ORIGIN: "not a url" }),
    ).toThrow(/CORS_ORIGIN/);
  });

  it("answers CORS for each configured origin and no other", async () => {
    const app = createApp({
      jwtSecret: base.JWT_SECRET,
      features: readFeatureSettings({}),
      corsOrigin: "https://ridecore.vercel.app,http://localhost:8081",
      logging: false,
    });
    for (const origin of [
      "https://ridecore.vercel.app",
      "http://localhost:8081",
    ]) {
      const response = await request(app)
        .get("/api/health")
        .set("Origin", origin);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
    }
    const other = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("trusts the hosting proxy only when configured", () => {
    const features = readFeatureSettings({});
    expect(createApp({ features, logging: false }).get("trust proxy")).toBe(
      false,
    );
    expect(
      createApp({ features, logging: false, trustProxy: 1 }).get("trust proxy"),
    ).toBe(1);
    expect(readEnvironment(base).TRUST_PROXY).toBe(0);
  });

  it("shows mock codes in production only when explicitly enabled", async () => {
    expect(readFeatureSettings({}).OTP_MOCK_DELIVERY).toBe(false);
    expect(
      readFeatureSettings({ OTP_MOCK_DELIVERY: "true" }).OTP_MOCK_DELIVERY,
    ).toBe(true);
    expect(
      await deliverPhoneOtp({ code: "123456", runtimeMode: "production" }),
    ).toEqual({});
    expect(
      await deliverPhoneOtp({
        code: "123456",
        runtimeMode: "production",
        mockDelivery: true,
      }),
    ).toEqual({ mockCode: "123456" });
  });
});
