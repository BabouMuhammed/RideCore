// Executes the actual mobile API/session code against an unchanged disposable backend.
// No backend .env, production database, native SecureStore or real subscriber data is used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const requireMobile = createRequire(import.meta.url);
const requireBackend = createRequire(
  new URL('../../backend/package.json', import.meta.url),
);
const ts = requireMobile('typescript');
const mobileRoot = fileURLToPath(new URL('../', import.meta.url));
const compiledRoot = resolve(mobileRoot, '.verification/contract-runtime');
for (const name of [
  'services/api',
  'services/contracts',
  'services/errors',
  'features/auth/phone',
  'features/auth/validation',
  'features/session/SessionController',
]) {
  const source = readFileSync(resolve(mobileRoot, 'src', name + '.ts'), 'utf8');
  const output = resolve(compiledRoot, 'src', name + '.js');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
const { createApi } = requireMobile(
  resolve(compiledRoot, 'src/services/api.js'),
);
const { SessionController } = requireMobile(
  resolve(compiledRoot, 'src/features/session/SessionController.js'),
);
const { registrationPayload, loginPayload } = requireMobile(
  resolve(compiledRoot, 'src/features/auth/validation.js'),
);
const mongoose = requireBackend('mongoose');
const { MongoMemoryReplSet } = requireBackend('mongodb-memory-server');
const { createApp } = await import('../../backend/src/app.js');
const { models, Ride } = await import('../../backend/src/models/index.js');
const localBinary = 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe';
let replica, server;
try {
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: existsSync(localBinary)
      ? { systemBinary: localBinary, version: '8.2.1' }
      : {},
  });
  await mongoose.connect(replica.getUri(), {
    dbName: 'ridecore_mobile_contract_only',
  });
  await Promise.all(models.map((model) => model.init()));
  const app = createApp({
    jwtSecret: 'disposable-mobile-contract-key',
    logging: false,
    runtimeMode: 'test',
  });
  server = await new Promise((yes, no) => {
    const instance = app.listen(0, '127.0.0.1', () => yes(instance));
    instance.once('error', no);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const api = createApi(baseUrl);
  const nationalNumbers = [
    '87' + '7' + '0'.repeat(6),
    '83' + '3' + '0'.repeat(6),
    '86' + '6' + '0'.repeat(6),
    '99' + '0'.repeat(5),
  ];
  for (const [index, national] of nationalNumbers.entries()) {
    // In-memory credential adapter is for this Node contract test only; the app uses SecureStore.
    let credential = null;
    const store = {
      get: async () => credential,
      set: async (value) => {
        credential = value;
      },
      clear: async () => {
        credential = null;
      },
    };
    const session = new SessionController(api, store);
    await session.restore();
    const payload = registrationPayload({
      firstName: 'Contract',
      lastName: 'Fixture',
      email: `mobile-contract-${index}@example.test`,
      phone: national,
      password: 'Contract-only-password',
    });
    const registered = await api.register(payload);
    assert.equal(registered.phone, '+220' + national);
    assert.equal(registered.token, undefined);
    assert.equal(session.getSnapshot().stage, 'anonymous');
    await session.signIn(loginPayload('phone', national, payload.password));
    assert.equal(session.getSnapshot().stage, 'ready');
    assert.equal(session.getSnapshot().user.phone, payload.phone);
    assert.equal(session.getSnapshot().activeRide, null);
    const otp = await session.requestOtp();
    assert.match(otp.mockCode, /^\d{6}$/);
    await session.verifyOtp(otp.mockCode);
    assert.ok(session.getSnapshot().user.phoneVerifiedAt);
    let fixtureRideId;
    if (index === 0) {
      // A test-only setup fixture, not a booking method or screen in the mobile app.
      const result = await fetch(baseUrl + '/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential}`,
        },
        body: JSON.stringify({
          pickup: {
            address: 'Synthetic pickup',
            location: { type: 'Point', coordinates: [0, 0] },
          },
          destination: {
            address: 'Synthetic destination',
            location: { type: 'Point', coordinates: [0.01, 0.01] },
          },
          vehicleType: 'economy',
        }),
      });
      assert.equal(result.status, 201);
      fixtureRideId = (await result.json()).data._id;
      await session.restore();
      assert.equal(session.getSnapshot().activeRide._id, fixtureRideId);
      assert.equal(session.getSnapshot().activeRide.status, 'requested');
    }
    await session.logout();
    assert.equal(credential, null);
    assert.equal(session.getSnapshot().stage, 'anonymous');
    assert.equal(session.getSnapshot().activeRide, undefined);
    if (fixtureRideId)
      assert.equal((await Ride.findById(fixtureRideId)).status, 'requested');
    console.log(
      `PASS mobile/backend structure ${index + 1}: canonical register, password login, validated session, ride discovery, mock OTP, local logout`,
    );
  }
  console.log(
    'PASS authoritative active-ride detail restoration; logout leaves the ride unchanged.',
  );
  console.log(
    'PASS 4 phone structures using the actual mobile contracts and unchanged isolated backend.',
  );
} finally {
  if (server) await new Promise((yes) => server.close(yes));
  await mongoose.disconnect();
  if (replica) await replica.stop();
}
