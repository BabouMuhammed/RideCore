import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const localMongoBinary = "C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  models,
  User,
  DriverProfile,
  Vehicle,
  Ride,
} from "../src/models/index.js";
export const secret = "integration-only-secret-never-used-outside-tests";
export const password = "Testing-password-123";
export const registration = {
  firstName: "Test",
  lastName: "Rider",
  email: "rider@example.test",
  phone: "+447700900001",
  password,
  role: "rider",
};
export const location = { type: "Point", coordinates: [-0.12, 51.5] };
export const rideInput = {
  pickup: { address: "Pickup", location },
  destination: {
    address: "Destination",
    location: { type: "Point", coordinates: [-0.1, 51.52] },
  },
  vehicleType: "economy",
};
export const vehicleInput = {
  make: "Toyota",
  model: "Prius",
  year: 2022,
  color: "Blue",
  plateNumber: "TEST001",
  vehicleType: "economy",
  seats: 4,
};
export let app, actors, repl;
let hash;
export async function setup() {
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: {
      version: existsSync(localMongoBinary) ? "8.2.1" : "7.0.24",
      systemBinary:
        process.env.MONGOMS_SYSTEM_BINARY ||
        (existsSync(localMongoBinary) ? localMongoBinary : undefined),
      downloadDir: fileURLToPath(
        new URL("../.cache/mongodb-binaries/", import.meta.url),
      ),
    },
  });
  await mongoose.connect(repl.getUri(), { dbName: "ridecore_tests" });
  await Promise.all(models.map((m) => m.init()));
  hash = await bcrypt.hash(password, 4);
}
export async function reset() {
  for (const m of [...models].reverse()) await m.deleteMany({});
  app = createApp({ jwtSecret: secret, logging: false });
  actors = {};
  for (const [index, name] of [
    "rider",
    "driver",
    "driver2",
    "other",
    "admin",
  ].entries()) {
    const role = name.startsWith("driver")
      ? "driver"
      : name === "admin"
        ? "admin"
        : "rider";
    const user = await User.create({
      ...registration,
      email: `${name}@example.test`,
      phone: `+44770090000${index}`,
      password: hash,
      role,
    });
    actors[name] = {
      user,
      token: jwt.sign({}, secret, {
        subject: String(user._id),
        expiresIn: "2h",
        issuer: "ride-core",
        audience: "ride-core-api",
      }),
    };
    if (role === "driver") {
      const profile = await DriverProfile.create({
        user: user._id,
        licenseNumber: `LICENSE${index}`,
        verificationStatus: "approved",
        availabilityStatus: "online",
        currentLocation: location,
      });
      const vehicle = await Vehicle.create({
        ...vehicleInput,
        driver: user._id,
        plateNumber: `PLATE${index}`,
        verificationStatus: "approved",
      });
      Object.assign(actors[name], { profile, vehicle });
    }
  }
}
export async function cleanup() {
  await mongoose.disconnect();
  if (repl) await repl.stop();
}
export function api(name, method, path, body) {
  const r = request(app)[method](path);
  if (name) r.set("Authorization", `Bearer ${actors[name].token}`);
  return body === undefined ? r : r.send(body);
}
export async function createRide() {
  const r = await api("rider", "post", "/api/rides", rideInput);
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return r.body.data;
}
export async function acceptedRide() {
  const ride = await createRide();
  const r = await api("driver", "patch", `/api/rides/${ride._id}/accept`);
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  return r.body.data;
}
export async function completedRide() {
  const ride = await acceptedRide();
  for (const action of ["arriving", "arrived", "start", "complete"]) {
    const r = await api("driver", "patch", `/api/rides/${ride._id}/${action}`);
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  }
  return Ride.findById(ride._id);
}
