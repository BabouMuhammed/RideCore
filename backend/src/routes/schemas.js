import { z } from "zod";
const text = z.string().trim().min(1).max(120);
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "Password exceeds bcrypt byte limit",
  );
const email = z.string().trim().toLowerCase().email().max(254);
export const phoneNumber = z
  .string()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .pipe(
    z.string().regex(/^\+[1-9]\d{7,14}$/, "Use international phone format"),
  );
export const registration = z
  .object({
    firstName: text,
    lastName: text,
    email,
    phone: phoneNumber,
    password,
    role: z.enum(["rider", "driver"]).default("rider"),
  })
  .strict();
export const credentials = z
  .object({ email: email.optional(), phone: phoneNumber.optional(), password })
  .strict()
  .refine(
    (data) => Boolean(data.email) !== Boolean(data.phone),
    "Provide exactly one email or phone",
  );
export const point = z
  .object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  })
  .strict();
const stop = z.object({ address: text, location: point }).strict();
export const rideInput = z
  .object({
    pickup: stop,
    destination: stop,
    vehicleType: z.enum(["economy", "comfort", "xl"]).default("economy"),
  })
  .strict();
export const licenseInput = z
  .object({ licenseNumber: text.transform((s) => s.toUpperCase()) })
  .strict();
export const vehicleInput = z
  .object({
    make: text,
    model: text,
    year: z
      .number()
      .int()
      .min(1980)
      .max(new Date().getFullYear() + 1),
    color: text,
    plateNumber: text.transform((s) => s.toUpperCase()),
    vehicleType: z.enum(["economy", "comfort", "xl"]),
    seats: z.number().int().min(1).max(12),
  })
  .strict();
export const availability = z
  .object({ availabilityStatus: z.enum(["online", "offline"]) })
  .strict();
export const cancellation = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();
export const paymentInput = z
  .object({ method: z.enum(["cash", "mock_wallet"]) })
  .strict();
export const ratingInput = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();
export const verification = z
  .object({ verificationStatus: z.enum(["approved", "rejected", "suspended"]) })
  .strict();
export const activeInput = z.object({ isActive: z.boolean() }).strict();

export const nearbyQuery = z
  .object({
    lat: z.string().trim().min(1).pipe(z.coerce.number().min(-90).max(90)),
    lng: z.string().trim().min(1).pipe(z.coerce.number().min(-180).max(180)),
  })
  .strict();
export const otpRequest = z.object({}).strict();
export const otpVerification = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .strict();

export const shareCreation = z.object({}).strict().default({});
