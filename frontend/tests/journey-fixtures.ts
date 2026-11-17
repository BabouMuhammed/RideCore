import type { JourneyApi, Trip } from '../src/services/journey-api';
import { rider } from './fixtures';
export const tripFixture: Trip = {
  _id: 'b'.repeat(24),
  rider: rider._id,
  status: 'requested',
  pickup: {
    address: 'Synthetic pickup',
    location: { type: 'Point', coordinates: [-16.5, 13.4] },
  },
  destination: {
    address: 'Synthetic destination',
    location: { type: 'Point', coordinates: [-16.49, 13.41] },
  },
  vehicleType: 'economy',
  estimatedFare: 125,
  currency: 'GMD',
  requestedAt: '2026-10-28T12:00:00.000Z',
};
export function journeyApi(): jest.Mocked<JourneyApi> {
  return {
    nearby: jest.fn<
      ReturnType<JourneyApi['nearby']>,
      Parameters<JourneyApi['nearby']>
    >(async () => []),
    nearbyDrivers: jest.fn<
      ReturnType<JourneyApi['nearbyDrivers']>,
      Parameters<JourneyApi['nearbyDrivers']>
    >(async () => []),
    estimate: jest.fn<
      ReturnType<JourneyApi['estimate']>,
      Parameters<JourneyApi['estimate']>
    >(async () => ({
      estimatedFare: 125,
      currency: 'GMD' as const,
      distance: 1,
      estimatedDuration: 2,
      distanceMethod: 'haversine_straight_line',
    })),
    create: jest.fn<
      ReturnType<JourneyApi['create']>,
      Parameters<JourneyApi['create']>
    >(async () => tripFixture),
    list: jest.fn<
      ReturnType<JourneyApi['list']>,
      Parameters<JourneyApi['list']>
    >(async () => []),
    detail: jest.fn<
      ReturnType<JourneyApi['detail']>,
      Parameters<JourneyApi['detail']>
    >(async () => tripFixture),
    cancel: jest.fn<
      ReturnType<JourneyApi['cancel']>,
      Parameters<JourneyApi['cancel']>
    >(async () => ({
      ...tripFixture,
      status: 'cancelled' as const,
    })),
    payment: jest.fn<
      ReturnType<JourneyApi['payment']>,
      Parameters<JourneyApi['payment']>
    >(async () => null),
    pay: jest.fn<ReturnType<JourneyApi['pay']>, Parameters<JourneyApi['pay']>>(
      async () => ({
        _id: 'c'.repeat(24),
        ride: tripFixture._id,
        amount: 125,
        currency: 'GMD' as const,
        method: 'cash' as const,
        status: 'paid' as const,
        paidAt: '2026-10-28T12:00:00.000Z',
      }),
    ),
    rate: jest.fn<
      ReturnType<JourneyApi['rate']>,
      Parameters<JourneyApi['rate']>
    >(async () => undefined),
    share: jest.fn<
      ReturnType<JourneyApi['share']>,
      Parameters<JourneyApi['share']>
    >(async () => ({
      token: 's'.repeat(43),
      sharePath: '/track/' + 's'.repeat(43),
      expiresAt: '2026-10-28T13:00:00.000Z',
    })),
    revoke: jest.fn<
      ReturnType<JourneyApi['revoke']>,
      Parameters<JourneyApi['revoke']>
    >(async () => undefined),
    snapshot: jest.fn<
      ReturnType<JourneyApi['snapshot']>,
      Parameters<JourneyApi['snapshot']>
    >(),
  };
}
