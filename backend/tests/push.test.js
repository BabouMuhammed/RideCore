import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
const sent = vi.hoisted(() => []);
const failNext = vi.hoisted(() => ({ status: 0 }));
vi.mock("web-push", async (original) => {
  const real = (await original()).default;
  return {
    default: {
      ...real,
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async (subscription, payload) => {
        if (failNext.status) {
          const error = Object.assign(new Error("gone"), {
            statusCode: failNext.status,
          });
          failNext.status = 0;
          throw error;
        }
        sent.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) });
      }),
    },
  };
});
import {
  setup,
  reset,
  cleanup,
  api,
  createRide,
  acceptedRide,
} from "./helpers.js";
import { AppSetting, PushSubscription } from "../src/models/index.js";
import { resetVapidCache } from "../src/services/push.js";
beforeAll(setup);
beforeEach(async () => {
  await reset();
  resetVapidCache();
  sent.length = 0;
});
afterAll(cleanup);

const subscription = (name) => ({
  endpoint: `https://push.example.test/${name}`,
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
});
const subscribe = (name) =>
  api(name, "post", "/api/push/subscriptions", subscription(name));
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("push notifications", () => {
  it("serves one stable public key, generated once and stored", async () => {
    const first = await api(null, "get", "/api/push/public-key");
    expect(first.status).toBe(200);
    expect(first.body.data.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    resetVapidCache();
    const second = await api(null, "get", "/api/push/public-key");
    expect(second.body.data.publicKey).toBe(first.body.data.publicKey);
    expect(await AppSetting.countDocuments({ key: "vapid" })).toBe(1);
  });

  it("requires sign-in and a valid subscription", async () => {
    expect(
      (await api(null, "post", "/api/push/subscriptions", subscription("x")))
        .status,
    ).toBe(401);
    expect(
      (
        await api("rider", "post", "/api/push/subscriptions", {
          endpoint: "http://insecure.test",
          keys: { p256dh: "a", auth: "b" },
        })
      ).status,
    ).toBe(400);
    expect((await subscribe("rider")).status).toBe(201);
    expect(await PushSubscription.countDocuments()).toBe(1);
    expect(
      (
        await api("rider", "delete", "/api/push/subscriptions", {
          endpoint: subscription("rider").endpoint,
        })
      ).status,
    ).toBe(200);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it("alerts nearby drivers to a new request", async () => {
    await subscribe("driver");
    await subscribe("other");
    await createRide();
    await settle();
    expect(sent).toEqual([
      expect.objectContaining({
        endpoint: subscription("driver").endpoint,
        title: "New ride request",
      }),
    ]);
  });

  it("tells the rider when a driver accepts and when they arrive", async () => {
    await subscribe("rider");
    const ride = await acceptedRide();
    await settle();
    expect(sent.at(-1)).toMatchObject({
      endpoint: subscription("rider").endpoint,
      title: expect.stringMatching(/is on the way$/),
      body: expect.stringContaining("PLATE"),
    });
    await api("driver", "patch", `/api/rides/${ride._id}/arriving`);
    await api("driver", "patch", `/api/rides/${ride._id}/arrived`);
    await settle();
    expect(sent.at(-1)).toMatchObject({
      title: "Your driver has arrived",
      requireInteraction: true,
    });
  });

  it("tells the driver when the rider cancels", async () => {
    await subscribe("driver");
    const ride = await acceptedRide();
    await settle();
    sent.length = 0;
    await api("rider", "patch", `/api/rides/${ride._id}/cancel`, {
      reason: "Changed plans",
    });
    await settle();
    expect(sent).toEqual([
      expect.objectContaining({ title: "The rider cancelled" }),
    ]);
  });

  it("drops subscriptions the push service says are gone", async () => {
    await subscribe("rider");
    failNext.status = 410;
    await acceptedRide();
    await settle();
    expect(await PushSubscription.countDocuments()).toBe(0);
  });
});
