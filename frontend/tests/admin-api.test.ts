import { createAdminApi } from '../src/services/admin-api';
import { createDriverApi } from '../src/services/driver-api';

const objectId = 'a'.repeat(24);
function adapter(data: unknown, status = 200) {
  const fetcher = jest
    .fn()
    .mockResolvedValue({
      ok: status < 400,
      status,
      headers: { get: () => null },
      json: async () => ({ success: status < 400, data }),
    });
  return { api: createAdminApi('https://example.test/api', fetcher), fetcher };
}
test('overview rejects partial/fabricated metric data rather than filling missing counts with zero', async () => {
  await expect(
    adapter({ registeredRiders: 1 }).api.overview('credential'),
  ).rejects.toMatchObject({ kind: 'contract' });
});
test('admin requests use distinct profile, vehicle and user IDs with existing payloads', async () => {
  const h = adapter({});
  await h.api.verify('credential', 'drivers', objectId, 'approved');
  await h.api.verify('credential', 'vehicles', 'b'.repeat(24), 'rejected');
  await h.api.setActive('credential', 'c'.repeat(24), false);
  expect(
    h.fetcher.mock.calls.map((c) => [c[0], JSON.parse(c[1].body)]),
  ).toEqual([
    [
      `https://example.test/api/admin/drivers/${objectId}/verification`,
      { verificationStatus: 'approved' },
    ],
    [
      `https://example.test/api/admin/vehicles/${'b'.repeat(24)}/verification`,
      { verificationStatus: 'rejected' },
    ],
    [
      `https://example.test/api/admin/users/${'c'.repeat(24)}/active`,
      { isActive: false },
    ],
  ]);
});
test.each(['pending', 'paid', 'failed', 'refunded'])(
  'payment monitor accepts %s without requiring paidAt and preserves legacy currency',
  async (status) => {
    const h = adapter([
      {
        _id: objectId,
        ride: 'b'.repeat(24),
        method: 'cash',
        status,
        amount: 125,
        transactionReference: 'SIM-test',
      },
    ]);
    expect(await h.api.payments('credential', 2)).toEqual([
      expect.objectContaining({ status, paidAt: undefined, currency: 'GBP' }),
    ]);
    expect(h.fetcher.mock.calls[0][0]).toBe(
      'https://example.test/api/admin/payments?page=2',
    );
  },
);
test('driver API accepts suspended profile and suspended vehicle without permitting online actions', async () => {
  const h = adapter({
    profile: {
      verificationStatus: 'suspended',
      availabilityStatus: 'offline',
      licenseNumber: 'TEST',
    },
    vehicle: {
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      color: 'Silver',
      plateNumber: 'TEST',
      vehicleType: 'economy',
      seats: 4,
      verificationStatus: 'suspended',
    },
  });
  const api = createDriverApi('https://example.test/api', h.fetcher);
  expect(await api.account('credential')).toMatchObject({
    profile: { verificationStatus: 'suspended' },
    vehicle: { verificationStatus: 'suspended' },
  });
});
test('administrative 403 expires access while mutation conflicts stay recoverable', async () => {
  await expect(
    adapter({}, 403).api.overview('credential'),
  ).rejects.toMatchObject({ kind: 'role' });
  await expect(
    adapter({}, 409).api.verify('credential', 'drivers', objectId, 'approved'),
  ).rejects.toMatchObject({ kind: 'changed' });
});
