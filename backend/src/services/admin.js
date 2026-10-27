import mongoose from "mongoose";
import {
  User,
  DriverProfile,
  Vehicle,
  Ride,
  Payment,
} from "../models/index.js";
import { requireThat } from "../utils/errors.js";
const collections = {
  users: User,
  drivers: DriverProfile,
  rides: Ride,
  payments: Payment,
};
export async function listResources(kind, page) {
  const pageNumber = /^\d{1,6}$/.test(String(page || "1"))
    ? Math.max(1, Number(page || 1))
    : 1;
  const rows = await collections[kind]
    .find()
    .sort({ _id: -1 })
    .skip((pageNumber - 1) * 50)
    .limit(50);
  if (kind !== "drivers") return rows;
  // Vehicle review already exists; expose the associated vehicle through this existing admin list.
  const ids = rows.map((row) => row.user);
  const [vehicles, accounts] = await Promise.all([
    Vehicle.find({ driver: { $in: ids } }),
    User.find({ _id: { $in: ids } }).select("firstName lastName isActive"),
  ]);
  return rows.map((row) => ({
    ...row.toJSON(),
    vehicle:
      vehicles.find((v) => String(v.driver) === String(row.user))?.toJSON() ||
      null,
    account:
      accounts.find((a) => String(a._id) === String(row.user))?.toJSON() ||
      null,
  }));
}
export async function verifyResource(kind, id, status) {
  return mongoose.connection.transaction(async (session) => {
    const Model = kind === "drivers" ? DriverProfile : Vehicle;
    const resource = await Model.findById(id).session(session);
    requireThat(resource, 404, "Resource not found");
    const userId = kind === "drivers" ? resource.user : resource.driver;
    requireThat(
      !(await Ride.exists({ driver: userId, active: true }).session(session)),
      409,
      "Driver has an active ride",
    );
    if (status === "approved" && kind === "drivers")
      requireThat(resource.licenseNumber, 409, "License information required");
    resource.verificationStatus = status;
    await resource.save({ session });
    await DriverProfile.updateOne(
      { user: userId },
      { availabilityStatus: "offline" },
      { session },
    );
    return resource;
  });
}
export async function setUserActive(id, actor, isActive) {
  requireThat(
    !actor._id.equals(id),
    409,
    "Cannot change your own activation status",
  );
  return mongoose.connection.transaction(async (session) => {
    requireThat(
      !(await Ride.exists({
        active: true,
        $or: [{ rider: id }, { driver: id }],
      }).session(session)),
      409,
      "User has an active ride",
    );
    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { returnDocument: "after", session },
    );
    requireThat(user, 404, "User not found");
    await DriverProfile.updateOne(
      { user: id },
      { availabilityStatus: "offline" },
      { session },
    );
    return user;
  });
}
