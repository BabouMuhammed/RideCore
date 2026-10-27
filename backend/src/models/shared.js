import { Schema } from "mongoose";
export const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
export const options = {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    },
  },
};
export const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: (v) =>
        v.length === 2 &&
        Number.isFinite(v[0]) &&
        Number.isFinite(v[1]) &&
        Math.abs(v[0]) <= 180 &&
        Math.abs(v[1]) <= 90,
    },
  },
  { _id: false },
);
