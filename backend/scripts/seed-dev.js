// Development-only: set up a working rider, an approved online driver and an
// admin through the real API, so the full ride flow can be demonstrated
// without manual Postman steps. Safe to run repeatedly.
//
//   npm run dev            (in one terminal)
//   npm run seed:dev       (in another)
//
// Refuses to run with NODE_ENV=production. Uses its own demo passwords;
// override them with SEED_PASSWORD if you like.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/index.js";
import { connectDatabase } from "../src/config/db.js";
import { readEnvironment } from "../src/config/env.js";

const api = process.env.SEED_API_URL || "http://localhost:5050/api";
const password = process.env.SEED_PASSWORD || "RideCore-dev-2026";

// Serrekunda, near Westfield junction: [longitude, latitude]
const driverStart = [-16.6781, 13.4389];

const accounts = {
  rider: {
    firstName: "Awa",
    lastName: "Jallow",
    email: "rider@ridecore.test",
    phone: "+2203000001",
    role: "rider",
  },
  driver: {
    firstName: "Lamin",
    lastName: "Sanneh",
    email: "driver@ridecore.test",
    phone: "+2203000002",
    role: "driver",
  },
  admin: {
    firstName: "Ride",
    lastName: "Administrator",
    email: "admin@ridecore.test",
    phone: "+2203000003",
  },
};

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function ensureUser(person) {
  const created = await call("POST", "/auth/register", {
    body: { ...person, password },
  });
  if (created.status !== 201 && created.status !== 409)
    throw new Error(
      `Could not register ${person.email} (${created.status}): ${created.json?.message ?? ""}`,
    );
  const login = await call("POST", "/auth/login", {
    body: { email: person.email, password },
  });
  if (login.status !== 200)
    throw new Error(
      `Could not sign in ${person.email}. If it already existed with another password, set SEED_PASSWORD.`,
    );
  return login.json.data.token;
}

async function ensureAdmin(env) {
  await connectDatabase(env.MONGODB_URI);
  await User.init();
  const existing = await User.findOne({ email: accounts.admin.email });
  if (!existing) {
    await User.create({
      ...accounts.admin,
      password: await bcrypt.hash(password, 12),
      role: "admin",
      isVerified: true,
    });
  }
  await mongoose.disconnect();
  const login = await call("POST", "/auth/login", {
    body: { email: accounts.admin.email, password },
  });
  if (login.status !== 200)
    throw new Error("Could not sign in the seed admin. Check SEED_PASSWORD.");
  return login.json.data.token;
}

function check(result, what) {
  if (result.status >= 400)
    throw new Error(
      `${what} failed (${result.status}): ${result.json?.message ?? ""}`,
    );
  return result.json.data;
}

try {
  const env = readEnvironment();
  if (env.NODE_ENV === "production")
    throw new Error("seed:dev never runs with NODE_ENV=production.");

  const health = await call("GET", "/health").catch(() => null);
  if (!health || health.status !== 200)
    throw new Error(`The API is not reachable at ${api}. Start it with npm run dev.`);

  const adminToken = await ensureAdmin(env);
  await ensureUser(accounts.rider);
  const driverToken = await ensureUser(accounts.driver);

  const profile = check(
    await call("PUT", "/drivers/profile", {
      token: driverToken,
      body: { licenseNumber: "GMB-DL-0001" },
    }),
    "Driver profile",
  );
  const vehicle = check(
    await call("PUT", "/drivers/vehicle", {
      token: driverToken,
      body: {
        make: "Toyota",
        model: "Corolla",
        year: 2016,
        color: "Silver",
        plateNumber: "KM4821B",
        vehicleType: "economy",
        seats: 4,
      },
    }),
    "Driver vehicle",
  );

  for (const [kind, id] of [
    ["drivers", profile._id],
    ["vehicles", vehicle._id],
  ]) {
    check(
      await call("PATCH", `/admin/${kind}/${id}/verification`, {
        token: adminToken,
        body: { verificationStatus: "approved" },
      }),
      `Approve ${kind}`,
    );
  }

  check(
    await call("PATCH", "/drivers/location", {
      token: driverToken,
      body: { type: "Point", coordinates: driverStart },
    }),
    "Driver location",
  );
  const online = await call("PATCH", "/drivers/availability", {
    token: driverToken,
    body: { availabilityStatus: "online" },
  });
  // A driver who is busy on an unfinished ride stays busy; that's fine.
  if (online.status >= 400 && online.status !== 409) check(online, "Go online");

  console.log("RideCore development accounts are ready.\n");
  console.log(`  Rider   ${accounts.rider.email}`);
  console.log(`  Driver  ${accounts.driver.email}  (approved, online in Serrekunda)`);
  console.log(`  Admin   ${accounts.admin.email}`);
  console.log(`  Password for all three: ${process.env.SEED_PASSWORD ? "your SEED_PASSWORD" : password}`);
} catch (error) {
  console.error(`seed:dev stopped: ${error.message}`);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => undefined);
}
