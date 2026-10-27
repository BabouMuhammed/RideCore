import { createApi } from '../src/services/api';
import { AppError } from '../src/services/errors';
import { rider, activeRide, national } from './fixtures';
import {
  registrationPayload,
  loginPayload,
} from '../src/features/auth/validation';
function response(data: unknown, status = 200, retry?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: { get: () => retry ?? null },
  } as unknown as Response;
}
function apiWith(
  data: unknown = { success: true, data: rider },
  status = 200,
  retry?: string,
) {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(response(data, status, retry));
  return {
    api: createApi('https://ridecore.example.test/api', fetcher),
    fetcher,
  };
}
test('registration uses the exact canonical payload and accepts the token-less response', async () => {
  const h = apiWith();
  const payload = registrationPayload({
    ...rider,
    phone: national,
    password: 'test-password',
  });
  await expect(h.api.register(payload)).resolves.toEqual(rider);
  expect(h.fetcher).toHaveBeenCalledWith(
    'https://ridecore.example.test/api/auth/register',
    expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
  );
  expect(JSON.parse(h.fetcher.mock.calls[0]![1]!.body as string)).toEqual({
    firstName: rider.firstName,
    lastName: rider.lastName,
    email: rider.email,
    phone: rider.phone,
    password: 'test-password',
    role: 'rider',
  });
});
test.each(['email', 'phone'] as const)(
  '%s login sends exactly one identifier',
  async (mode) => {
    const h = apiWith({ success: true, data: { token: 'test-credential' } });
    const payload = loginPayload(
      mode,
      mode === 'phone' ? national : rider.email,
      'test-password',
    );
    await h.api.login(payload);
    expect(h.fetcher.mock.calls[0]![1]!.body).toBe(JSON.stringify(payload));
  },
);
test('authenticated OTP is bound to the registered canonical phone; no unsupported phone field is sent', async () => {
  const h = apiWith({
    success: true,
    data: { expiresInSeconds: 300, mockCode: '000000' },
  });
  expect((await h.api.requestOtp('credential')).mockCode).toBe('000000');
  expect(h.fetcher.mock.calls[0]![1]).toMatchObject({
    method: 'POST',
    body: '{}',
    headers: { Authorization: 'Bearer credential' },
  });
  await h.api.verifyOtp('credential', '000000');
  expect(h.fetcher.mock.calls[1]![1]!.body).toBe(
    JSON.stringify({ code: '000000' }),
  );
});
test('ride discovery and details use only rider-readable GET routes', async () => {
  const h = apiWith({ success: true, data: [activeRide] });
  await h.api.rides('credential');
  h.fetcher.mockResolvedValueOnce(
    response({ success: true, data: activeRide }),
  );
  await h.api.ride('credential', activeRide._id);
  expect(
    h.fetcher.mock.calls.map(([path, options]) => [path, options!.method]),
  ).toEqual([
    ['https://ridecore.example.test/api/rides/me', 'GET'],
    ['https://ridecore.example.test/api/rides/' + activeRide._id, 'GET'],
  ]);
});
test.each([
  [401, 'credentials'],
  [400, 'validation'],
  [429, 'rate'],
  [503, 'server'],
] as const)('login HTTP %s maps to safe %s feedback', async (status, kind) => {
  const h = apiWith(
    { success: false, error: { message: 'internal private stack and secret' } },
    status,
  );
  try {
    await h.api.login({ email: rider.email, password: 'test-password' });
    throw new Error('Expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).not.toContain('internal private');
  }
});
test('a protected 401 is an authentication failure, not a connectivity failure', async () => {
  const h = apiWith({}, 401);
  await expect(h.api.me('expired')).rejects.toMatchObject({
    kind: 'unauthenticated',
  });
});
test('transport failures are sanitized connectivity errors', async () => {
  const h = apiWith();
  h.fetcher.mockRejectedValue(new Error('private URL and native stack'));
  await expect(h.api.me('credential')).rejects.toMatchObject({
    kind: 'network',
  });
});
test('OTP cooldown uses the server Retry-After when available', async () => {
  const h = apiWith(
    { error: { message: 'Please wait before requesting another code' } },
    429,
    '120',
  );
  await expect(h.api.requestOtp('credential')).rejects.toMatchObject({
    kind: 'cooldown',
    retryAfterSeconds: 120,
  });
});
test('OTP wrong/expired/attempt-exhausted failures are safely represented', async () => {
  const h = apiWith(
    { error: { message: 'Invalid or expired verification code' } },
    400,
  );
  await expect(h.api.verifyOtp('credential', '000000')).rejects.toMatchObject({
    kind: 'otp',
  });
});
test('malformed ride ids cannot become requests', async () => {
  const h = apiWith();
  await expect(h.api.ride('credential', '../auth/me')).rejects.toMatchObject({
    kind: 'contract',
  });
  expect(h.fetcher).not.toHaveBeenCalled();
});
test('unexpected success envelopes do not authenticate by accident', async () => {
  const h = apiWith({ token: 'not-an-envelope' });
  await expect(
    h.api.login({ email: rider.email, password: 'test-password' }),
  ).rejects.toMatchObject({ kind: 'contract' });
});
test('unknown lifecycle values fail closed', async () => {
  const h = apiWith({
    success: true,
    data: [{ ...activeRide, status: 'invented' }],
  });
  await expect(h.api.rides('credential')).rejects.toMatchObject({
    kind: 'contract',
  });
});
test('OTP response must contain real expiry metadata and a valid mock code when supplied', async () => {
  const h = apiWith({
    success: true,
    data: { expiresInSeconds: 0, mockCode: '1234' },
  });
  await expect(h.api.requestOtp('credential')).rejects.toMatchObject({
    kind: 'contract',
  });
});

test('API configuration tolerates a trailing slash without changing the route', async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(response({ success: true, data: rider }));
  await createApi(' https://ridecore.example.test/api/ ', fetcher).me(
    'credential',
  );
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://ridecore.example.test/api/auth/me',
  );
});
test.each([
  '',
  'not a URL',
  'https://user:password@ridecore.example.test/api',
  'https://ridecore.example.test/api?private=value',
])(
  'invalid or credential-bearing service configuration is rejected without a request',
  async (url) => {
    const fetcher = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    await expect(
      createApi(url, fetcher).me('credential'),
    ).rejects.toMatchObject({ kind: 'configuration' });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
