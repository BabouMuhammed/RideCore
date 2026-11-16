import mongoose from "mongoose";
import { DriverProfile, Vehicle, Ride, User } from "../models/index.js";
import { requireThat } from "../utils/errors.js";
export async function eligibleDriver(userId, session) {
  const profile = await DriverProfile.findOne({ user: userId }).session(
    session || null,
  );
  const vehicle = await Vehicle.findOne({ driver: userId }).session(
    session || null,
  );
  const user = await User.findById(userId).session(session || null);
  requireThat(
    user?.isActive &&
      user.role === "driver" &&
      profile?.verificationStatus === "approved" &&
      vehicle?.verificationStatus === "approved",
    403,
    "Approved driver profile and vehicle required",
  );
  return { profile, vehicle };
}
export async function updateProfile(user, input) {
  return mongoose.connection.transaction(async (session) => {
    const profile = await DriverProfile.findOneAndUpdate(
      { user: user._id, availabilityStatus: { $ne: "busy" } },
      {
        licenseNumber: input.licenseNumber,
        verificationStatus: "pending",
        availabilityStatus: "offline",
      },
      { returnDocument: "after", runValidators: true, session },
    );
    requireThat(profile, 409, "Cannot edit profile during an active ride");
    return profile;
  });
}
export async function updateVehicle(user, input) {
  return mongoose.connection.transaction(async (session) => {
    const profile = await DriverProfile.findOneAndUpdate(
      { user: user._id, availabilityStatus: { $ne: "busy" } },
      { availabilityStatus: "offline", $inc: { __v: 1 } },
      { returnDocument: "after", session },
    );
    requireThat(profile, 409, "Cannot edit vehicle during an active ride");
    return Vehicle.findOneAndUpdate(
      { driver: user._id },
      {
        make: input.make,
        model: input.model,
        year: input.year,
        color: input.color,
        plateNumber: input.plateNumber,
        vehicleType: input.vehicleType,
        seats: input.seats,
        verificationStatus: "pending",
      },
      { returnDocument: "after", upsert: true, runValidators: true, session },
    );
  });
}
export async function setLocation(user, location) {
  return DriverProfile.findOneAndUpdate(
    { user: user._id },
    { currentLocation: location, locationPersistedAt: new Date() },
    { returnDocument: "after", runValidators: true },
  );
}
export async function setAvailability(user, status) {
  return mongoose.connection.transaction(async (session) => {
    const active = await User.findOneAndUpdate(
      { _id: user._id, isActive: true },
      { $inc: { __v: 1 } },
      { session },
    );
    requireThat(active, 401, "Authentication required");
    if (status === "online") {
      const { profile } = await eligibleDriver(user._id, session);
      requireThat(
        profile.currentLocation,
        409,
        "Set a location before going online",
      );
    }
    const profile = await DriverProfile.findOneAndUpdate(
      { user: user._id, availabilityStatus: { $ne: "busy" } },
      { availabilityStatus: status, $inc: { __v: 1 } },
      { returnDocument: "after", session },
    );
    requireThat(
      profile,
      409,
      "Availability cannot change during an active ride",
    );
    return profile;
  });
}
export { nearbyDrivers } from "./nearby.js";
