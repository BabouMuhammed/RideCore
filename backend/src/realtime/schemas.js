import { z } from "zod";
import { objectId } from "../middleware/validate.js";
export const roomInput = z.object({ rideId: objectId }).strict();
export const trackingInput = z
  .object({
    rideId: objectId,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    heading: z.number().min(0).lt(360).optional(),
    speed: z.number().min(0).max(100).optional(),
  })
  .strict();
