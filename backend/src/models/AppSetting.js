import { Schema, model } from "mongoose";
import { options } from "./shared.js";
// Small server-held values, e.g. the generated Web Push (VAPID) keys.
const schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  options,
);
export const AppSetting = model("AppSetting", schema);
