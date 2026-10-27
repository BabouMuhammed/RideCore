// Disposable full-stack browser harness. Never loads .env or connects to the user's database.
if (
  process.env.RIDECORE_BROWSER_TEST !== "1" ||
  process.env.NODE_ENV !== "test"
)
  throw new Error("Browser harness requires explicit test mode");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const { existsSync } = await import("node:fs");
const { randomBytes } = await import("node:crypto");
const mongoose = (await import("mongoose")).default;
const bcrypt = (await import("bcryptjs")).default;
const { models, User } = await import("../src/models/index.js");
const { createHttpServer } = await import("../src/http-server.js");
const local = "C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe";
const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: {
    version: existsSync(local) ? "8.2.1" : "7.0.24",
    systemBinary: existsSync(local) ? local : undefined,
  },
});
await mongoose.connect(repl.getUri(), {
  dbName: "ridecore_browser_integration",
});
await Promise.all(models.map((model) => model.init()));
await User.create({
  firstName: "Browser",
  lastName: "Administrator",
  email: "browser-admin@example.test",
  phone: "+2205000099",
  password: await bcrypt.hash("Browser-test-password-123", 12),
  role: "admin",
});
const { server, io } = createHttpServer({
  jwtSecret: randomBytes(48).toString("hex"),
  runtimeMode: "test",
  corsOrigin: "http://localhost:3004",
  logging: false,
});
server.listen(5054, "127.0.0.1", () =>
  console.log("Disposable browser integration API ready"),
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => io.close(resolve));
  await mongoose.disconnect();
  await repl.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
