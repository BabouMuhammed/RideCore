// Disposable test driver/admin actions live here, never in the Rider application.
// Uses real mobile adapters, unchanged backend, a temporary DB and ephemeral port.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url),
  backend = createRequire(
    new URL('../../backend/package.json', import.meta.url),
  );
const ts = require('typescript'),
  root = fileURLToPath(new URL('../', import.meta.url)),
  out = resolve(root, '.verification/rider-runtime');
for (const name of [
  'services/api',
  'services/contracts',
  'services/errors',
  'services/journey-api',
  'services/realtime',
  'features/session/SessionController',
  'features/journey/JourneyController',
]) {
  const target = resolve(out, 'src', name + '.js');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    ts.transpileModule(
      readFileSync(resolve(root, 'src', name + '.ts'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  );
}
const load = (name) => require(resolve(out, 'src', name + '.js'));
const { createApi } = load('services/api'),
  { createJourneyApi } = load('services/journey-api');
const { SessionController } = load('features/session/SessionController'),
  { JourneyController } = load('features/journey/JourneyController');
const { watchRide } = load('services/realtime'),
  { io } = require('socket.io-client');
const mongoose = backend('mongoose'),
  bcrypt = backend('bcryptjs');
const { MongoMemoryReplSet } = backend('mongodb-memory-server');
const { createApp } = await import('../../backend/src/app.js');
const { attachRealtime } = await import('../../backend/src/realtime/server.js');
const { models, User, Ride } =
  await import('../../backend/src/models/index.js');
const { readFeatureSettings } =
  await import('../../backend/src/config/features.js');
const secret = 'isolated-rider-journey-test-only',
  password = 'Disposable-password-123';
let replica, server, realtime, driverSocket, publicSocket, journey;
let passed = 0;
async function check(name, work) {
  await work();
  passed++;
  console.log('PASS ' + name);
}
async function until(predicate) {
  const end = Date.now() + 15000;
  while (!predicate()) {
    assert.ok(
      Date.now() < end,
      'Timed out waiting for authoritative integration state',
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
try {
  const binary = 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe';
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: existsSync(binary)
      ? { systemBinary: binary, version: '8.2.1' }
      : {},
  });
  await mongoose.connect(replica.getUri(), {
    dbName: 'rider_journey_disposable',
  });
  await Promise.all(models.map((model) => model.init()));
  const features = readFeatureSettings();
  const app = createApp({
    jwtSecret: secret,
    logging: false,
    runtimeMode: 'test',
    corsOrigin: 'http://localhost:8081',
    features,
  });
  server = await new Promise((resolve) => {
    const value = app.listen(0, '127.0.0.1', () => resolve(value));
  });
  const origin = `http://127.0.0.1:${server.address().port}`,
    base = origin + '/api';
  process.env.EXPO_PUBLIC_API_URL = base;
  realtime = attachRealtime(server, {
    jwtSecret: secret,
    corsOrigin: 'http://localhost:8081',
    features,
  });
  const api = createApi(base),
    rides = createJourneyApi(base);
  let saved = null;
  const session = new SessionController(api, {
    get: async () => saved,
    set: async (token) => {
      saved = token;
    },
    clear: async () => {
      saved = null;
    },
  });
  const run = (work) => session.run(work);
  const input = {
    pickup: {
      address: 'Synthetic test pickup',
      location: { type: 'Point', coordinates: [-16.5, 13.4] },
    },
    destination: {
      address: 'Synthetic test destination',
      location: { type: 'Point', coordinates: [-16.49, 13.41] },
    },
    vehicleType: 'economy',
  };
  const raw = async (token, method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const driverAction = async (token, method, path, body) => {
    const response = await raw(token, method, path, body);
    assert.equal(response.status, 200);
    return response.body.data;
  };
  await check(
    'registration, email login, server identity and missing-token bootstrap',
    async () => {
      await session.restore();
      assert.equal(session.getSnapshot().stage, 'anonymous');
      const user = await api.register({
        firstName: 'Synthetic',
        lastName: 'Rider',
        email: 'journey-rider@example.test',
        phone: '+220' + '99' + '0'.repeat(5),
        password,
        role: 'rider',
      });
      assert.equal(user.token, undefined);
      assert.equal(session.getSnapshot().stage, 'anonymous');
      await session.signIn({ email: user.email, password });
      assert.equal(session.getSnapshot().stage, 'ready');
      await assert.rejects(
        api.login({ email: user.email, password: 'Incorrect-password' }),
        { kind: 'credentials' },
      );
      await assert.rejects(api.me('malformed'), { kind: 'unauthenticated' });
    },
  );
  const driverUser = await api.register({
    firstName: 'Synthetic',
    lastName: 'Driver',
    email: 'journey-driver@example.test',
    phone: '+220' + '98' + '0'.repeat(5),
    password,
    role: 'driver',
  });
  const driverToken = (await api.login({ email: driverUser.email, password }))
    .token;
  await User.create({
    firstName: 'Synthetic',
    lastName: 'Admin',
    email: 'journey-admin@example.test',
    phone: '+220' + '97' + '0'.repeat(5),
    password: await bcrypt.hash(password, 4),
    role: 'admin',
  });
  const adminToken = (
    await api.login({ email: 'journey-admin@example.test', password })
  ).token;
  await check(
    'driver profile/vehicle approval, real availability and GPS eligibility',
    async () => {
      const profile = await driverAction(
        driverToken,
        'PUT',
        '/drivers/profile',
        { licenseNumber: 'SYNTHETIC-LICENSE' },
      );
      const vehicle = await driverAction(
        driverToken,
        'PUT',
        '/drivers/vehicle',
        {
          make: 'Toyota',
          model: 'Test vehicle',
          year: 2022,
          color: 'White',
          plateNumber: 'SYNTHETIC1',
          vehicleType: 'economy',
          seats: 4,
        },
      );
      assert.equal(
        (
          await raw(driverToken, 'PATCH', '/drivers/availability', {
            availabilityStatus: 'online',
          })
        ).status,
        403,
      );
      await driverAction(
        adminToken,
        'PATCH',
        '/admin/drivers/' + profile._id + '/verification',
        { verificationStatus: 'approved' },
      );
      await driverAction(
        adminToken,
        'PATCH',
        '/admin/vehicles/' + vehicle._id + '/verification',
        { verificationStatus: 'approved' },
      );
      await driverAction(
        driverToken,
        'PATCH',
        '/drivers/location',
        input.pickup.location,
      );
      await driverAction(driverToken, 'PATCH', '/drivers/availability', {
        availabilityStatus: 'online',
      });
    },
  );
  await check('all three estimates use actual backend GMD fare', async () => {
    for (const vehicleType of ['economy', 'comfort', 'xl']) {
      const estimate = await run((token, signal) =>
        rides.estimate(token, { ...input, vehicleType }, signal),
      );
      assert.equal(estimate.currency, 'GMD');
      assert.ok(estimate.estimatedFare > 0);
    }
  });
  journey = new JourneyController(
    rides,
    run,
    session.getSnapshot().user._id,
    null,
    watchRide,
  );
  let trip;
  await check(
    'request, one-active protection, authenticated room join and session restoration',
    async () => {
      await journey.refresh();
      trip = await journey.request(input);
      assert.equal(trip.status, 'requested');
      await until(() => journey.getSnapshot().connected);
      await assert.rejects(
        run((token, signal) => rides.create(token, input, signal)),
        { kind: 'changed' },
      );
      // A separate controller represents an app restart without mutating the live test session.
      const restored = new SessionController(api, {
        get: async () => saved,
        set: async () => {},
        clear: async () => {},
      });
      await restored.restore();
      assert.equal(restored.getSnapshot().activeRide._id, trip._id);
      restored.dispose();
    },
  );
  await check(
    'eligible driver discovers and accepts request; rider reconciles accepted event',
    async () => {
      const requests = await driverAction(
        driverToken,
        'GET',
        '/drivers/ride-requests',
      );
      assert.ok(requests.some((value) => value._id === trip._id));
      await driverAction(
        driverToken,
        'PATCH',
        '/rides/' + trip._id + '/accept',
      );
      await until(() => journey.getSnapshot().trip?.status === 'accepted');
      assert.equal(
        journey.getSnapshot().trip.vehicle.plateNumber,
        'SYNTHETIC1',
      );
    },
  );
  let grant;
  await check(
    'share create, unauthenticated snapshot and read-only public socket join',
    async () => {
      grant = await run((token, signal) =>
        rides.share(token, trip._id, signal),
      );
      assert.ok(Date.parse(grant.expiresAt) > Date.now());
      const snapshot = await rides.snapshot(grant.token);
      assert.equal(snapshot.rideStatus, 'accepted');
      assert.equal(snapshot.rider, undefined);
      publicSocket = io(origin + '/shared-rides', {
        forceNew: true,
        transports: ['websocket'],
      });
      await new Promise((resolve, reject) => {
        publicSocket.once('connect', resolve);
        publicSocket.once('connect_error', reject);
      });
      const reply = await publicSocket
        .timeout(10000)
        .emitWithAck('share:join', { token: grant.token });
      assert.equal(reply.success, true);
      const denied = await publicSocket
        .timeout(10000)
        .emitWithAck('ride:join', { rideId: trip._id });
      assert.equal(denied.success, false);
    },
  );
  await check(
    'real driver socket GPS reaches rider and public snapshot without synthetic client motion',
    async () => {
      driverSocket = io(origin, {
        auth: { token: driverToken },
        forceNew: true,
        transports: ['websocket'],
      });
      await new Promise((resolve, reject) => {
        driverSocket.once('connect', resolve);
        driverSocket.once('connect_error', reject);
      });
      const reply = await driverSocket
        .timeout(10000)
        .emitWithAck('driver:location:update', {
          rideId: trip._id,
          latitude: 13.4001,
          longitude: -16.5001,
        });
      assert.equal(reply.success, true);
      await until(() => journey.getSnapshot().location?.point[0] === -16.5001);
      assert.equal(
        (await rides.snapshot(grant.token)).location.longitude,
        -16.5001,
      );
    },
  );
  await check(
    'revocation ends recipient access and permits a fresh expiring grant',
    async () => {
      const ended = new Promise((resolve) =>
        publicSocket.once('share:ended', resolve),
      );
      await run((token, signal) => rides.revoke(token, trip._id, signal));
      await ended;
      await assert.rejects(rides.snapshot(grant.token), {
        kind: 'unavailable',
      });
      grant = await run((token, signal) =>
        rides.share(token, trip._id, signal),
      );
    },
  );
  await check(
    'actual driver transitions, fresh room rejoin and REST recovery complete the ride',
    async () => {
      // Dispose/recreate the watcher to exercise reconnect + authenticated room rejoin.
      journey.dispose();
      journey = new JourneyController(
        rides,
        run,
        session.getSnapshot().user._id,
        trip._id,
        watchRide,
      );
      await journey.refresh();
      await until(() => journey.getSnapshot().connected);
      for (const [action, status] of [
        ['arriving', 'driver_arriving'],
        ['arrived', 'driver_arrived'],
        ['start', 'in_progress'],
        ['complete', 'completed'],
      ]) {
        await driverAction(
          driverToken,
          'PATCH',
          '/rides/' + trip._id + '/' + action,
        );
        await until(() => journey.getSnapshot().trip?.status === status);
      }
      assert.equal(journey.getSnapshot().trip.finalFare, trip.estimatedFare);
      assert.equal(journey.getSnapshot().location, null);
      await assert.rejects(rides.snapshot(grant.token), {
        kind: 'unavailable',
      });
    },
  );
  await check(
    'payment result, same-method idempotency, conflict and rating duplicate protection',
    async () => {
      assert.equal(
        await run((token, signal) => rides.payment(token, trip._id, signal)),
        null,
      );
      const paid = await run((token, signal) =>
        rides.pay(token, trip._id, 'cash', signal),
      );
      const duplicate = await run((token, signal) =>
        rides.pay(token, trip._id, 'cash', signal),
      );
      assert.equal(paid._id, duplicate._id);
      assert.equal(paid.currency, 'GMD');
      assert.equal(paid.amount, trip.estimatedFare);
      await assert.rejects(
        run((token, signal) =>
          rides.pay(token, trip._id, 'mock_wallet', signal),
        ),
        { kind: 'changed' },
      );
      await run((token, signal) =>
        rides.rate(token, trip._id, 5, 'Synthetic integration review', signal),
      );
      await assert.rejects(
        run((token, signal) =>
          rides.rate(token, trip._id, 5, 'Duplicate', signal),
        ),
        { kind: 'changed' },
      );
      assert.equal(
        (await run((token, signal) => rides.detail(token, trip._id, signal)))
          .myRating.rating,
        5,
      );
    },
  );
  await check(
    'mock wallet records a genuine completed simulated payment without claiming real funds',
    async () => {
      journey.dismiss();
      await driverAction(driverToken, 'PATCH', '/drivers/availability', {
        availabilityStatus: 'online',
      });
      const walletTrip = await journey.request(input);
      await until(() => journey.getSnapshot().connected);
      for (const [action, status] of [
        ['accept', 'accepted'],
        ['arriving', 'driver_arriving'],
        ['arrived', 'driver_arrived'],
        ['start', 'in_progress'],
        ['complete', 'completed'],
      ]) {
        await driverAction(
          driverToken,
          'PATCH',
          '/rides/' + walletTrip._id + '/' + action,
        );
        await until(() => journey.getSnapshot().trip?.status === status);
      }
      const payment = await run((token, signal) =>
        rides.pay(token, walletTrip._id, 'mock_wallet', signal),
      );
      assert.equal(payment.method, 'mock_wallet');
      assert.equal(payment.status, 'paid');
      assert.equal(payment.currency, 'GMD');
      assert.equal(payment.amount, walletTrip.estimatedFare);
    },
  );
  await check(
    'history/detail, cancellation reason, API failures and authorization rejection',
    async () => {
      assert.ok(
        (await run((token, signal) => rides.list(token, signal))).some(
          (value) => value._id === trip._id,
        ),
      );
      journey.dismiss();
      const next = await journey.request(input);
      await assert.rejects(
        run((token, signal) => rides.pay(token, next._id, 'cash', signal)),
        { kind: 'changed' },
      );
      await assert.rejects(
        run((token, signal) => rides.rate(token, next._id, 5, '', signal)),
        { kind: 'changed' },
      );
      await assert.rejects(journey.cancel(' '), { kind: 'validation' });
      await journey.cancel('Changed plans');
      assert.equal(journey.getSnapshot().trip.status, 'cancelled');
      assert.equal(
        (await raw(saved, 'GET', '/drivers/ride-requests')).status,
        403,
      );
      assert.equal((await raw(null, 'GET', '/rides/me')).status, 401);
      const unavailable = createJourneyApi(base, async () => {
        throw new TypeError('Offline');
      });
      await assert.rejects(unavailable.list(saved), { kind: 'network' });
    },
  );
  await check(
    'local logout clears credentials/private state while a real active ride remains unchanged',
    async () => {
      journey.dismiss();
      const next = await journey.request(input);
      journey.dispose();
      await session.logout();
      assert.equal(saved, null);
      assert.equal(session.getSnapshot().stage, 'anonymous');
      assert.equal((await Ride.findById(next._id)).status, 'requested');
    },
  );
  console.log(
    `Rider integration: ${passed} checks passed, 0 failed. No real database or backend environment was used.`,
  );
} finally {
  journey?.dispose();
  driverSocket?.disconnect();
  publicSocket?.disconnect();
  if (realtime) await new Promise((resolve) => realtime.close(resolve));
  else if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
}
