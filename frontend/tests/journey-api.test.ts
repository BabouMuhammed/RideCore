import {
  createJourneyApi,
  coordinate,
  publicSnapshot,
} from '../src/services/journey-api';
import { tripFixture as trip } from './journey-fixtures';
function adapter(data: unknown, status = 200) {
  const fetcher = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => ({ success: true, data }),
  });
  return {
    api: createJourneyApi('https://api.example.test/api', fetcher),
    fetcher,
  };
}
test.each(['economy', 'comfort', 'xl'] as const)(
  'estimate for %s uses server fare and exact booking payload',
  async (vehicleType) => {
    const h = adapter({
      estimatedFare: 125,
      currency: 'GMD',
      distance: 1,
      estimatedDuration: 2,
      distanceMethod: 'haversine_straight_line',
    });
    const input = {
      pickup: trip.pickup,
      destination: trip.destination,
      vehicleType,
    };
    expect((await h.api.estimate('credential', input)).estimatedFare).toBe(125);
    expect(h.fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify(input),
      headers: { Authorization: 'Bearer credential' },
    });
  },
);
test('ride creation and cancellation cannot call driver progression routes', async () => {
  const h = adapter(trip);
  await h.api.create('credential', {
    pickup: trip.pickup,
    destination: trip.destination,
    vehicleType: 'economy',
  });
  await h.api.cancel('credential', trip._id, ' Changed plans ');
  expect(h.fetcher.mock.calls.map((call) => new URL(call[0]).pathname)).toEqual(
    ['/api/rides', '/api/rides/' + trip._id + '/cancel'],
  );
  expect(JSON.parse(h.fetcher.mock.calls[1]![1].body)).toEqual({
    reason: 'Changed plans',
  });
  await expect(h.api.cancel('credential', trip._id, ' ')).rejects.toMatchObject(
    { kind: 'validation' },
  );
});
test('payment retrieval distinguishes not-yet-recorded from unavailable server', async () => {
  await expect(
    adapter(null, 404).api.payment('credential', trip._id),
  ).resolves.toBeNull();
  await expect(
    adapter(null, 503).api.payment('credential', trip._id),
  ).rejects.toMatchObject({ kind: 'server' });
});
test('payment mutation sends method only, never an amount or currency override', async () => {
  const h = adapter({
    _id: 'c'.repeat(24),
    ride: trip._id,
    method: 'mock_wallet',
    amount: 125,
    currency: 'GMD',
    status: 'paid',
    paidAt: trip.requestedAt,
  });
  await h.api.pay('credential', trip._id, 'mock_wallet');
  expect(JSON.parse(h.fetcher.mock.calls[0]![1].body)).toEqual({
    method: 'mock_wallet',
  });
});
test.each([0, 6, 1.5])(
  'invalid rating %s never sends a request',
  async (rating) => {
    const h = adapter({});
    await expect(
      h.api.rate('credential', trip._id, rating, ''),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(h.fetcher).not.toHaveBeenCalled();
  },
);
test('rating uses exact fields and duplicate feedback stays safe', async () => {
  const h = adapter({});
  await h.api.rate('credential', trip._id, 5, ' Good ride ');
  expect(JSON.parse(h.fetcher.mock.calls[0]![1].body)).toEqual({
    rating: 5,
    comment: 'Good ride',
  });
  await expect(
    adapter(null, 409).api.rate('credential', trip._id, 5, ''),
  ).rejects.toMatchObject({ kind: 'changed' });
});
test('share creation validates bearer capability and public snapshots omit private JWT', async () => {
  const token = 's'.repeat(43),
    h = adapter({
      token,
      sharePath: '/track/' + token,
      expiresAt: '2027-01-01T00:00:00Z',
    });
  expect((await h.api.share('credential', trip._id)).token).toBe(token);
  const snapshot = {
    rideStatus: 'accepted',
    driver: null,
    vehicle: null,
    location: null,
    trip: {
      pickup: { address: 'Pickup', longitude: 0, latitude: 0 },
      destination: { address: 'Destination', longitude: 1, latitude: 1 },
    },
    sharing: { expiresAt: '2027-01-01T00:00:00Z' },
  };
  const p = adapter(snapshot);
  await p.api.snapshot(token);
  expect(p.fetcher.mock.calls[0]![1].headers.Authorization).toBeUndefined();
  await expect(p.api.snapshot('invalid')).rejects.toMatchObject({
    kind: 'unavailable',
  });
});
test.each([
  { ...trip, pickup: null },
  { ...trip, status: 'fake' },
  { ...trip, estimatedFare: '125' },
  { ...trip, currency: 'USD' },
  {
    ...trip,
    trackingLocation: {
      location: { coordinates: [0, 0] },
      updatedAt: 'not-a-timestamp',
    },
  },
])('malformed trip DTO is rejected', async (value) => {
  await expect(
    adapter(value).api.detail('credential', trip._id),
  ).rejects.toMatchObject({ kind: 'contract' });
});
test('history keeps legacy GBP without relabelling it as GMD', async () => {
  const { currency: _currency, ...legacy } = trip;
  expect((await adapter([legacy]).api.list('credential'))[0]!.currency).toBe(
    'GBP',
  );
});
test('coordinate and snapshot validation reject invalid public samples', () => {
  expect(() => coordinate([0, 100])).toThrow();
  expect(() => publicSnapshot({ rideStatus: 'completed' })).toThrow();
});
test('rider availability uses the actual nearby endpoint without exposing coordinates as UI fields', async () => {
  const h = adapter([
    { vehicle: { vehicleType: 'economy' } },
    { vehicle: { vehicleType: 'comfort' } },
  ]);
  expect(await h.api.nearby('credential', [-16.5, 13.4])).toEqual([
    'economy',
    'comfort',
  ]);
  const url = new URL(h.fetcher.mock.calls[0]![0]);
  expect(url.pathname).toBe('/api/drivers/nearby');
  expect(url.searchParams.get('lat')).toBe('13.4');
  expect(url.searchParams.get('lng')).toBe('-16.5');
  await expect(h.api.nearby('credential', [200, 0])).rejects.toMatchObject({
    kind: 'contract',
  });
});
