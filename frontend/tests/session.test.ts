import { AppError } from '../src/services/errors';
import { activeStatuses } from '../src/services/contracts';
import { harness, rider, activeRide, deferred } from './fixtures';
test('missing secure credential enters authentication without contacting private endpoints', async () => {
  const h = harness();
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toEqual({ stage: 'anonymous' });
  expect(h.api.me).not.toHaveBeenCalled();
});
test('a stored credential alone does not authenticate until me and ride discovery finish', async () => {
  const h = harness('credential');
  const gate = deferred<typeof rider>();
  h.api.me.mockReturnValue(gate.promise);
  const restoring = h.controller.restore();
  await Promise.resolve();
  expect(h.controller.getSnapshot().stage).toBe('restoring');
  gate.resolve(rider);
  await restoring;
  expect(h.controller.getSnapshot()).toEqual({
    stage: 'ready',
    user: rider,
    activeRide: null,
  });
});
test.each(['expired', 'malformed'])(
  '%s credential is removed after a server authentication rejection',
  async (token) => {
    const h = harness(token);
    h.api.me.mockRejectedValue(new AppError('unauthenticated'));
    await h.controller.restore();
    expect(h.saved()).toBeNull();
    expect(h.controller.getSnapshot()).toEqual({
      stage: 'anonymous',
      expired: true,
    });
    expect(h.api.rides).not.toHaveBeenCalled();
  },
);
test.each(['network', 'server'] as const)(
  '%s failure preserves the credential and supports retry',
  async (kind) => {
    const h = harness('credential');
    h.api.me.mockRejectedValueOnce(new AppError(kind));
    await h.controller.restore();
    expect(h.saved()).toBe('credential');
    expect(h.store.clear).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({
      stage: 'recovery',
      step: 'session',
      error: { kind },
    });
    await h.controller.retry();
    expect(h.controller.getSnapshot().stage).toBe('ready');
  },
);
test.each(['admin', 'unsupported'])(
  'server role %s cannot enter the app',
  async (role) => {
    const h = harness('credential');
    h.api.me.mockResolvedValue({ ...rider, role });
    await h.controller.restore();
    expect(h.controller.getSnapshot().stage).toBe('rejected');
    expect(h.saved()).toBeNull();
    expect(h.api.rides).not.toHaveBeenCalled();
  },
);
test('secure storage failure is recoverable and does not pretend to be logged out', async () => {
  const h = harness('credential');
  h.store.get.mockRejectedValueOnce(new Error('native private error'));
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'recovery',
    step: 'storage',
    error: { kind: 'storage' },
  });
  await h.controller.retry();
  expect(h.controller.getSnapshot().stage).toBe('ready');
});
test.each(activeStatuses)(
  'active %s state is restored from the authoritative detail',
  async (status) => {
    const h = harness('credential');
    h.api.rides.mockResolvedValue([{ ...activeRide, status }]);
    h.api.ride.mockResolvedValue({ ...activeRide, status });
    await h.controller.restore();
    expect(h.api.ride).toHaveBeenCalledWith(
      'credential',
      activeRide._id,
      expect.any(AbortSignal),
    );
    expect(h.controller.getSnapshot()).toMatchObject({
      stage: 'ready',
      activeRide: { status },
    });
  },
);
test.each(['completed', 'cancelled'] as const)(
  '%s history is not an active ride',
  async (status) => {
    const h = harness('credential');
    h.api.rides.mockResolvedValue([{ ...activeRide, status }]);
    await h.controller.restore();
    expect(h.controller.getSnapshot()).toMatchObject({
      stage: 'ready',
      activeRide: null,
    });
    expect(h.api.ride).not.toHaveBeenCalled();
  },
);
test('detail can show a newer terminal state than the list without simulating progression', async () => {
  const h = harness('credential');
  h.api.rides.mockResolvedValue([activeRide]);
  h.api.ride.mockResolvedValue({ ...activeRide, status: 'completed' });
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'ready',
    activeRide: null,
  });
});
test('ride restoration failure preserves the credential and blocks incomplete bootstrap', async () => {
  const h = harness('credential');
  h.api.rides.mockRejectedValueOnce(new AppError('network'));
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'recovery',
    step: 'rides',
  });
  expect(h.saved()).toBe('credential');
  await h.controller.retry();
  expect(h.controller.getSnapshot().stage).toBe('ready');
});
test('unrelated ride data fails closed', async () => {
  const h = harness('credential');
  h.api.rides.mockResolvedValue([{ ...activeRide, rider: '2'.repeat(24) }]);
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'recovery',
    step: 'rides',
  });
});
test('multiple active records are not silently resolved by guessing', async () => {
  const h = harness('credential');
  h.api.rides.mockResolvedValue([
    activeRide,
    { ...activeRide, _id: 'b'.repeat(24) },
  ]);
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'recovery',
    step: 'rides',
  });
});
test('logout removes credential and all private session/ride data without a ride mutation', async () => {
  const h = harness('credential');
  h.api.rides.mockResolvedValue([activeRide]);
  await h.controller.restore();
  await h.controller.logout();
  expect(h.saved()).toBeNull();
  expect(h.controller.getSnapshot()).toEqual({
    stage: 'anonymous',
    expired: false,
  });
  expect(h.api.verifyOtp).not.toHaveBeenCalled();
  expect(h.api.rides).toHaveBeenCalledTimes(1);
});
test('a late restoration response cannot resurrect a logged-out session', async () => {
  const h = harness('credential');
  const gate = deferred<typeof rider>();
  h.api.me.mockReturnValue(gate.promise);
  const restore = h.controller.restore();
  await Promise.resolve();
  await h.controller.logout();
  gate.resolve(rider);
  await restore;
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
  expect(h.saved()).toBeNull();
});
test('logout deletion failure clears memory, blocks the shell and retries deletion', async () => {
  const h = harness('credential');
  await h.controller.restore();
  h.store.clear.mockRejectedValueOnce(new Error('private storage error'));
  await h.controller.logout();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'recovery',
    step: 'logout',
  });
  expect(h.controller.getSnapshot()).not.toHaveProperty('user');
  expect(h.controller.getSnapshot()).not.toHaveProperty('activeRide');
  await h.controller.retry();
  expect(h.saved()).toBeNull();
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
});
test('sign-in saves only the credential and validates it with the server', async () => {
  const h = harness();
  await h.controller.restore();
  await h.controller.signIn({ email: rider.email, password: 'test-password' });
  expect(h.store.set).toHaveBeenCalledWith('test-only-credential');
  expect(h.api.me).toHaveBeenCalledWith(
    'test-only-credential',
    expect.any(AbortSignal),
  );
  expect(h.controller.getSnapshot().stage).toBe('ready');
});
test('incorrect credentials never create a stored session', async () => {
  const h = harness();
  await h.controller.restore();
  h.api.login.mockRejectedValue(new AppError('credentials'));
  await expect(
    h.controller.signIn({ email: rider.email, password: 'wrong-password' }),
  ).rejects.toMatchObject({ kind: 'credentials' });
  expect(h.store.set).not.toHaveBeenCalled();
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
});
test('app restart validates the stored credential again', async () => {
  const h = harness('credential');
  await h.controller.restore();
  await h.controller.restore();
  expect(h.api.me).toHaveBeenCalledTimes(2);
  expect(h.api.rides).toHaveBeenCalledTimes(2);
});
test('expired credentials during optional verification remove the session', async () => {
  const h = harness('credential');
  await h.controller.restore();
  h.api.requestOtp.mockRejectedValue(new AppError('unauthenticated'));
  await expect(h.controller.requestOtp()).rejects.toMatchObject({
    kind: 'unauthenticated',
  });
  expect(h.saved()).toBeNull();
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
});
test('six-digit OTP validation occurs before a request and identity is refreshed on success', async () => {
  const h = harness('credential');
  await h.controller.restore();
  await expect(h.controller.verifyOtp('123')).rejects.toMatchObject({
    kind: 'otp',
  });
  expect(h.api.verifyOtp).not.toHaveBeenCalled();
  h.api.me.mockResolvedValue({
    ...rider,
    phoneVerifiedAt: '2026-10-27T00:00:00Z',
  });
  await h.controller.verifyOtp('000000');
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'ready',
    user: { phoneVerifiedAt: '2026-10-27T00:00:00Z' },
  });
});

test('logout wins over a credential write already in progress', async () => {
  const h = harness();
  await h.controller.restore();
  const started = deferred<void>();
  const gate = deferred<void>();
  const original = h.store.set.getMockImplementation()!;
  h.store.set.mockImplementation(async (token) => {
    started.resolve();
    await gate.promise;
    await original(token);
  });
  const signIn = h.controller
    .signIn({ email: rider.email, password: 'test-password' })
    .catch((error: unknown) => error);
  await started.promise;
  const logout = h.controller.logout();
  gate.resolve();
  await Promise.all([signIn, logout]);
  expect(h.saved()).toBeNull();
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
});
test('successful OTP with a failed identity refresh enters recovery and reconciles on retry', async () => {
  const h = harness('credential');
  await h.controller.restore();
  h.api.me.mockRejectedValueOnce(new AppError('network'));
  await expect(h.controller.verifyOtp('000000')).rejects.toMatchObject({
    kind: 'network',
  });
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'recovery',
    step: 'session',
  });
  expect(h.saved()).toBe('credential');
  h.api.me.mockResolvedValue({
    ...rider,
    phoneVerifiedAt: '2026-10-27T00:00:00Z',
  });
  await h.controller.retry();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'ready',
    user: { phoneVerifiedAt: '2026-10-27T00:00:00Z' },
  });
});

test('a failed secure credential write is rolled back instead of entering the rider shell', async () => {
  const h = harness();
  await h.controller.restore();
  h.store.set.mockRejectedValue(new Error('private native storage failure'));
  await expect(
    h.controller.signIn({ email: rider.email, password: 'test-password' }),
  ).rejects.toMatchObject({ kind: 'storage' });
  expect(h.store.clear).toHaveBeenCalled();
  expect(h.saved()).toBeNull();
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
  expect(h.api.me).not.toHaveBeenCalled();
});
test('role changes detected after OTP verification remove the private session', async () => {
  const h = harness('credential');
  await h.controller.restore();
  h.api.me.mockResolvedValue({ ...rider, role: 'driver' });
  await expect(h.controller.verifyOtp('000000')).rejects.toMatchObject({
    kind: 'role',
  });
  expect(h.controller.getSnapshot().stage).toBe('rejected');
  expect(h.saved()).toBeNull();
});
test('a driver signs in without loading rider trips', async () => {
  const h = harness('credential');
  h.api.me.mockResolvedValue({ ...rider, role: 'driver' });
  await h.controller.restore();
  expect(h.controller.getSnapshot()).toMatchObject({
    stage: 'ready',
    user: { role: 'driver' },
    activeRide: null,
  });
  expect(h.api.rides).not.toHaveBeenCalled();
});
