// Real frontend adapters/session controller -> HTTP API -> disposable MongoDB.
// Does not read .env, launch Expo, or use the developer's database or credentials.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const backend = createRequire(
  new URL('../../backend/package.json', import.meta.url),
);
const ts = require('typescript'),
  mongoose = backend('mongoose'),
  bcrypt = backend('bcryptjs');
const { MongoMemoryReplSet } = backend('mongodb-memory-server');
const { createApp } = await import('../../backend/src/app.js');
const { models, User } = await import('../../backend/src/models/index.js');
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url)),
  modules = new Map();
function load(file) {
  const path = resolve(sourceRoot, file + '.ts');
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (name) => {
    // Headless platform boundary only. URL validation runs the actual source.
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === 'expo-secure-store')
      return new Proxy(
        {},
        {
          get: () => () => {
            throw new Error('Native storage must not be used by this harness');
          },
        },
      );
    if (name.startsWith('.'))
      return load(relative(sourceRoot, resolve(dirname(path), name)));
    return require(name);
  };
  new Function('require', 'module', 'exports', '__DEV__', code)(
    localRequire,
    module,
    module.exports,
    false,
  );
  return module.exports;
}
const { createApi } = load('services/api');
const { createAdminApi } = load('services/admin-api');
const { createDriverApi } = load('services/driver-api');
const { createJourneyApi } = load('services/journey-api');
const { SessionController } = load('features/session/SessionController');
let replica, server;
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log('PASS ' + name);
}
const secret = randomBytes(48).toString('hex');
const password = randomBytes(18).toString('base64url');
try {
  const local = 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe';
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: existsSync(local)
      ? { systemBinary: local, version: '8.2.1' }
      : { version: '7.0.24' },
  });
  await mongoose.connect(replica.getUri(), {
    dbName: 'ridecore_admin_disposable',
  });
  await Promise.all(models.map((model) => model.init()));
  await User.create({
    firstName: 'Isolated',
    lastName: 'Administrator',
    email: 'admin@example.test',
    phone: '+2207000001',
    role: 'admin',
    password: await bcrypt.hash(password, 4),
  });
  const app = createApp({
    jwtSecret: secret,
    logging: false,
    runtimeMode: 'test',
  });
  server = await new Promise((resolve) => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const api = createApi(base),
    admin = createAdminApi(base),
    driverApi = createDriverApi(base),
    journey = createJourneyApi(base);
  let saved = null;
  const store = {
    get: async () => saved,
    set: async (value) => {
      saved = value;
    },
    clear: async () => {
      saved = null;
    },
  };
  const session = new SessionController(api, store);
  let token, riderToken, profile, vehicle, ride, driverId;
  const reg = {
    firstName: 'Isolated',
    lastName: 'Driver',
    email: 'driver@example.test',
    phone: '+2207000002',
    password,
    accountType: 'driver',
  };
  await check(
    'administrator sign-in, real overview and secure session restoration',
    async () => {
      await session.restore();
      await session.signIn({ email: 'admin@example.test', password }, 'admin');
      assert.equal(session.getSnapshot().user.role, 'admin');
      assert.equal(
        (await session.run((t, s) => admin.overview(t, s))).registeredDrivers,
        0,
      );
      await session.restore();
      assert.equal(session.getSnapshot().stage, 'ready');
    },
  );
  await check(
    'public driver/rider registration and admin-entry role denial before storage',
    async () => {
      driverId = (await api.register(reg))._id;
      token = (await api.login({ email: reg.email, password })).token;
      await api.register({
        ...reg,
        lastName: 'Rider',
        email: 'rider@example.test',
        phone: '+2207000003',
        accountType: 'rider',
      });
      riderToken = (await api.login({ email: 'rider@example.test', password }))
        .token;
      const attemptStore = {
        value: null,
        get: async () => null,
        set: async () => {
          throw new Error('Mismatched identity must never be persisted');
        },
        clear: async () => {},
      };
      const attempt = new SessionController(api, attemptStore);
      await attempt.restore();
      await assert.rejects(
        attempt.signIn({ email: reg.email, password }, 'admin'),
        (e) => e.kind === 'adminRequired',
      );
      await assert.rejects(
        admin.overview(riderToken),
        (e) => e.kind === 'role',
      );
      await assert.rejects(admin.overview(token), (e) => e.kind === 'role');
      attempt.dispose();
    },
  );
  await check(
    'separate driver and vehicle decisions keep driver offline',
    async () => {
      await driverApi.saveLicense(token, 'ISOLATED-LICENCE');
      await driverApi.saveVehicle(token, {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        color: 'Silver',
        plateNumber: 'ISOLATED-001',
        vehicleType: 'economy',
        seats: 4,
      });
      let rows = await session.run((t, s) => admin.drivers(t, 1, s));
      profile = rows[0]._id;
      vehicle = rows[0].vehicle._id;
      await driverApi.setLocation(token, [-16.678, 13.438]);
      await assert.rejects(
        driverApi.setAvailability(token, 'online'),
        (e) => e.kind === 'approval',
      );
      await session.run((t, s) =>
        admin.verify(t, 'drivers', profile, 'approved', s),
      );
      await assert.rejects(
        driverApi.setAvailability(token, 'online'),
        (e) => e.kind === 'approval',
      );
      await session.run((t, s) =>
        admin.verify(t, 'vehicles', vehicle, 'approved', s),
      );
      assert.equal(
        (await driverApi.account(token)).profile.availabilityStatus,
        'offline',
      );
      await driverApi.setAvailability(token, 'online');
      assert.equal(
        (await session.run((t, s) => admin.overview(t, s))).onlineDrivers,
        1,
      );
    },
  );
  await check(
    'nearby discovery, driver request and acceptance feed real admin ride monitoring',
    async () => {
      assert.equal(
        (await journey.nearbyDrivers(riderToken, [-16.678, 13.438]))[0].id,
        driverId,
      );
      ride = await journey.create(riderToken, {
        pickup: {
          address: 'Isolated Westfield test pickup',
          location: { type: 'Point', coordinates: [-16.678, 13.438] },
        },
        destination: {
          address: 'Isolated Serrekunda test destination',
          location: { type: 'Point', coordinates: [-16.681, 13.44] },
        },
        vehicleType: 'economy',
      });
      assert.equal((await driverApi.requests(token))[0]._id, ride._id);
      await driverApi.accept(token, ride._id);
      assert.equal(
        (await session.run((t, s) => admin.ride(t, ride._id, s))).driverName,
        'Isolated',
      );
      await assert.rejects(
        session.run((t, s) => admin.setActive(t, driverId, false, s)),
        (e) => e.kind === 'changed',
      );
    },
  );
  await check(
    'completed trip and simulated payment remain read-only admin records',
    async () => {
      for (const action of ['arriving', 'arrived', 'start', 'complete'])
        await driverApi.progress(token, ride._id, action);
      // Recording uses the existing rider payment API, never an admin action.
      await journey.pay(riderToken, ride._id, 'mock_wallet');
      const records = await session.run((t, s) => admin.payments(t, 1, s));
      assert.equal(records[0].currency, 'GMD');
      assert.ok(records[0].transactionReference.startsWith('SIM-'));
      assert.equal(
        (await session.run((t, s) => admin.overview(t, s))).completedRides,
        1,
      );
      assert.equal(
        (await session.run((t, s) => admin.rides(t, 1, s)))[0].status,
        'completed',
      );
    },
  );
  await check(
    'suspended profile and vehicle render through actual driver adapter',
    async () => {
      await session.run((t, s) =>
        admin.verify(t, 'drivers', profile, 'suspended', s),
      );
      await session.run((t, s) =>
        admin.verify(t, 'vehicles', vehicle, 'suspended', s),
      );
      const account = await driverApi.account(token);
      assert.equal(account.profile.verificationStatus, 'suspended');
      assert.equal(account.vehicle.verificationStatus, 'suspended');
      await assert.rejects(
        driverApi.setAvailability(token, 'online'),
        (e) => e.kind === 'approval',
      );
    },
  );
  await check(
    'account disable/restore preserves restrictions and admin logout clears credentials',
    async () => {
      await session.run((t, s) => admin.setActive(t, driverId, false, s));
      await assert.rejects(api.me(token), (e) => e.kind === 'unauthenticated');
      await session.run((t, s) => admin.setActive(t, driverId, true, s));
      assert.equal(
        (await driverApi.account(token)).profile.availabilityStatus,
        'offline',
      );
      assert.equal(
        (await session.run((t, s) => admin.users(t, 1, s))).length,
        3,
      );
      await session.logout();
      assert.equal(saved, null);
      assert.equal(session.getSnapshot().stage, 'anonymous');
      session.dispose();
    },
  );
  console.log(
    `${checks} isolated full-stack administrator checks passed. No browser/device UI was exercised.`,
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
}
