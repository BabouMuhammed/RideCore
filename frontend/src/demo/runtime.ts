import type { RiderApi, User, RideStatus } from '../services/contracts';
import type { CredentialStore } from '../services/credential-store';
import type {
  JourneyApi,
  Trip,
  Payment,
  Stop,
  Coordinate,
} from '../services/journey-api';
import type { RideWatcher } from '../services/realtime';
import { makeStop } from '../services/geo';
import { AppError } from '../services/errors';

export const demoPlaces: [Stop, Stop, Stop, Stop] = [
  makeStop('Senegambia Beach, Kololi', [-16.729, 13.441]),
  makeStop('Kairaba Avenue, Serrekunda', [-16.677, 13.454]),
  makeStop('Banjul International Airport', [-16.652, 13.338]),
  makeStop('Albert Market, Banjul', [-16.575, 13.454]),
];

let runtimeSequence = 0;

/** In-memory demo adapters never call the API, socket server or credential store. */
export function createDemoRuntime() {
  let user: User = {
    _id: 'd'.repeat(24),
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex@example.com',
    phone: '+2207654321',
    role: 'rider',
    isActive: true,
    phoneVerifiedAt: null,
  };
  let credential: string | null = 'ridecore-local-demo';
  let sequence = 100;
  const id = () => (++sequence).toString(16).padStart(24, '0');
  const fares = { economy: 150, comfort: 225, xl: 300 };
  const history: Trip[] = [0, 1].map((index) => ({
    _id: id(),
    rider: user._id,
    status: 'completed',
    pickup: demoPlaces[index]!,
    destination: demoPlaces[index + 1]!,
    vehicleType: 'economy',
    estimatedFare: 150,
    finalFare: 150,
    currency: 'GMD',
    requestedAt: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
    myRating: { rating: 5 },
  }));
  const payments = new Map<string, Payment>();
  const listeners = new Set<() => void>();
  const get = (rideId: string) => {
    const trip = history.find((item) => item._id === rideId);
    if (!trip) throw new AppError('unavailable');
    return trip;
  };
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const sessionApi: RiderApi = {
    register: async (input) => ({ ...user, ...input, _id: user._id }),
    login: async () => ({ token: 'ridecore-local-demo' }),
    me: async () => ({ ...user }),
    rides: async () => copy(history),
    ride: async (_token, rideId) => copy(get(rideId)),
    requestOtp: async () => ({ expiresInSeconds: 300, mockCode: '123456' }),
    verifyOtp: async (_token, code) => {
      if (code !== '123456') throw new AppError('otp');
      user = { ...user, phoneVerifiedAt: new Date().toISOString() };
    },
  };
  const store: CredentialStore = {
    get: async () => credential,
    set: async (value) => {
      credential = value;
    },
    clear: async () => {
      credential = null;
    },
  };
  const journeyApi: JourneyApi = {
    nearby: async () => ['economy', 'comfort', 'xl'],
    // Sample cars scattered around the requested point.
    nearbyDrivers: async (_token, [lng, lat]) =>
      (
        [
          [0.004, 0.003, 'economy'],
          [-0.005, 0.002, 'comfort'],
          [0.002, -0.004, 'economy'],
          [-0.003, -0.003, 'xl'],
        ] as const
      ).map(([dx, dy, category], index) => ({
        id: 'demo-driver-' + index,
        point: [lng + dx, lat + dy],
        category,
      })),
    estimate: async (_token, booking) => ({
      estimatedFare: fares[booking.vehicleType],
      currency: 'GMD',
      distance: 5.2,
      estimatedDuration: 14,
      distanceMethod: 'haversine_straight_line',
    }),
    create: async (_token, booking) => {
      if (
        history.some(
          (trip) => !['completed', 'cancelled'].includes(trip.status),
        )
      )
        throw new AppError('changed');
      const trip: Trip = {
        ...copy(booking),
        _id: id(),
        rider: user._id,
        status: 'requested',
        estimatedFare: fares[booking.vehicleType],
        currency: 'GMD',
        requestedAt: new Date().toISOString(),
      };
      history.unshift(trip);
      return copy(trip);
    },
    list: async () => copy(history),
    detail: async (_token, rideId) => copy(get(rideId)),
    cancel: async (_token, rideId) => {
      const trip = get(rideId);
      if (['in_progress', 'completed', 'cancelled'].includes(trip.status))
        throw new AppError('changed');
      trip.status = 'cancelled';
      return copy(trip);
    },
    payment: async (_token, rideId) => copy(payments.get(rideId) ?? null),
    pay: async (_token, rideId, method) => {
      const trip = get(rideId);
      if (trip.status !== 'completed') throw new AppError('changed');
      const payment: Payment = payments.get(rideId) ?? {
        _id: id(),
        ride: rideId,
        amount: trip.finalFare ?? trip.estimatedFare,
        currency: trip.currency,
        method,
        status: 'paid',
        paidAt: new Date().toISOString(),
      };
      payments.set(rideId, payment);
      return copy(payment);
    },
    rate: async (_token, rideId, rating, comment) => {
      get(rideId).myRating = { rating, comment };
    },
    share: async () => {
      throw new AppError('unavailable');
    },
    revoke: async () => undefined,
    snapshot: async () => {
      throw new AppError('unavailable');
    },
  };
  const maps = {
    search: async (query: string) => {
      const matches = demoPlaces.filter((place) =>
        place.address.toLowerCase().includes(query.toLowerCase().trim()),
      );
      return copy(matches.length ? matches : demoPlaces);
    },
    reverse: async (point: Coordinate) =>
      makeStop('Selected demo location', point),
    route: async (from: Coordinate, to: Coordinate): Promise<Coordinate[]> => [
      from,
      [from[0], to[1]],
      to,
    ],
  };
  const watch: RideWatcher = (_token, _rideId, handlers) => {
    const changed = () => handlers.changed();
    listeners.add(changed);
    handlers.connection(true);
    return () => {
      listeners.delete(changed);
    };
  };
  function advance(rideId: string) {
    const trip = get(rideId);
    const stages: RideStatus[] = [
      'requested',
      'accepted',
      'driver_arriving',
      'driver_arrived',
      'in_progress',
      'completed',
    ];
    const index = stages.indexOf(trip.status);
    if (index < 0 || index === stages.length - 1) return;
    const next = stages[index + 1];
    if (!next) return;
    trip.status = next;
    trip.driver = 'e'.repeat(24);
    trip.driverDetails = {
      firstName: 'Musa',
      rating: 4.94,
      verificationStatus: 'verified',
    };
    trip.vehicle = {
      make: 'Toyota',
      model: 'Corolla',
      color: 'Silver',
      plateNumber: 'DEMO 001',
    };
    trip.trackingLocation = {
      location: {
        coordinates:
          trip.status === 'in_progress' || trip.status === 'completed'
            ? trip.destination.location.coordinates
            : trip.pickup.location.coordinates,
      },
      updatedAt: new Date().toISOString(),
    };
    if (trip.status === 'completed') trip.finalFare = trip.estimatedFare;
    listeners.forEach((notify) => notify());
  }
  return {
    instanceId: ++runtimeSequence,
    sessionApi,
    store,
    journeyApi,
    maps,
    watch,
    advance,
  };
}
export type DemoRuntime = ReturnType<typeof createDemoRuntime>;
