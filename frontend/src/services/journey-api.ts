import { createTransport, record, ride, text, type ApiFetch } from './api';
import { apiUrl } from './server-config';
import type { Ride } from './contracts';
import { AppError } from './errors';

export type Coordinate = [number, number];
export type Stop = {
  address: string;
  location: { type: 'Point'; coordinates: Coordinate };
};
export type Category = 'economy' | 'comfort' | 'xl';
export const categories: Category[] = ['economy', 'comfort', 'xl'];
export type Booking = {
  pickup: Stop;
  destination: Stop;
  vehicleType: Category;
};
export type Estimate = {
  estimatedFare: number;
  currency: 'GMD';
  distance: number;
  estimatedDuration: number;
  distanceMethod: string;
};
export type Trip = Ride & {
  pickup: Stop;
  destination: Stop;
  vehicleType: Category;
  estimatedFare: number;
  finalFare?: number;
  currency: 'GMD' | 'GBP';
  requestedAt: string;
  driverDetails?: {
    firstName: string;
    rating: number | null;
    verificationStatus: string;
  } | null;
  vehicle?: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
  } | null;
  myRating?: { rating: number; comment?: string } | null;
  trackingLocation?: {
    location: { coordinates: Coordinate };
    updatedAt: string;
  };
};
export type Payment = {
  _id: string;
  ride: string;
  method: 'cash' | 'mock_wallet';
  amount: number;
  currency: 'GMD' | 'GBP';
  status: 'paid';
  paidAt: string;
};
export type ShareGrant = {
  token: string;
  sharePath: string;
  expiresAt: string;
};
export type PublicSnapshot = {
  rideStatus: Trip['status'];
  driver: { firstName: string; rating: number } | null;
  vehicle: Trip['vehicle'];
  location: { latitude: number; longitude: number; updatedAt: string } | null;
  trip: {
    pickup: { address: string; latitude: number; longitude: number };
    destination: { address: string; latitude: number; longitude: number };
  };
  sharing: { expiresAt: string };
};
export function coordinate(value: unknown): Coordinate {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((v) => typeof v === 'number' && Number.isFinite(v)) ||
    Math.abs(value[0]) > 180 ||
    Math.abs(value[1]) > 90
  )
    throw new AppError('contract');
  return [value[0], value[1]];
}
function number(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new AppError('contract');
  return value;
}
export function stop(value: unknown): Stop {
  const v = record(value),
    location = record(v.location);
  if (location.type !== 'Point') throw new AppError('contract');
  const address = text(v.address);
  if (address.length > 120) throw new AppError('validation');
  return {
    address,
    location: { type: 'Point', coordinates: coordinate(location.coordinates) },
  };
}
export function trip(value: unknown): Trip {
  const v = record(value),
    base = ride(value);
  if (!categories.includes(v.vehicleType as Category))
    throw new AppError('contract');
  const currency = v.currency ?? 'GBP'; // Historical backend records have no currency.
  if (!['GMD', 'GBP'].includes(String(currency)))
    throw new AppError('contract');
  if (v.driverDetails != null) {
    const driver = record(v.driverDetails);
    text(driver.firstName);
    if (driver.rating != null) number(driver.rating);
  }
  if (v.vehicle != null) {
    const vehicle = record(v.vehicle);
    for (const field of ['make', 'model', 'color', 'plateNumber'])
      text(vehicle[field]);
  }
  if (v.myRating != null) {
    const rating = number(record(v.myRating).rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new AppError('contract');
  }
  if (v.trackingLocation != null) {
    const sample = record(v.trackingLocation);
    coordinate(record(sample.location).coordinates);
    if (!Number.isFinite(Date.parse(text(sample.updatedAt))))
      throw new AppError('contract');
  }
  return {
    ...base,
    pickup: stop(v.pickup),
    destination: stop(v.destination),
    vehicleType: v.vehicleType as Category,
    estimatedFare: number(v.estimatedFare),
    ...(v.finalFare !== undefined ? { finalFare: number(v.finalFare) } : {}),
    currency: currency as Trip['currency'],
    requestedAt: text(v.requestedAt),
  } as Trip;
}
export function publicSnapshot(value: unknown): PublicSnapshot {
  const v = record(value),
    route = record(v.trip),
    sharing = record(v.sharing);
  if (
    !['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(
      text(v.rideStatus),
    )
  )
    throw new AppError('contract');
  for (const key of ['pickup', 'destination']) {
    const point = record(route[key]);
    text(point.address);
    coordinate([point.longitude, point.latitude]);
  }
  if (!Number.isFinite(Date.parse(text(sharing.expiresAt))))
    throw new AppError('contract');
  if (v.location != null) {
    const p = record(v.location);
    coordinate([p.longitude, p.latitude]);
    if (!Number.isFinite(Date.parse(text(p.updatedAt))))
      throw new AppError('contract');
  }
  if (v.driver != null) text(record(v.driver).firstName);
  if (v.vehicle != null)
    for (const field of ['make', 'model', 'color', 'plateNumber'])
      text(record(v.vehicle)[field]);
  return v as unknown as PublicSnapshot;
}
export type NearbyDriver = {
  id: string;
  point: Coordinate;
  category: Category;
};
export function createJourneyApi(
  baseUrl = apiUrl(),
  fetcher?: ApiFetch,
) {
  const call = createTransport(baseUrl, fetcher);
  const idPath = (id: string) => {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new AppError('contract');
    return '/rides/' + id;
  };
  const payment = (value: unknown): Payment => {
    const v = record(value);
    if (
      !['cash', 'mock_wallet'].includes(text(v.method)) ||
      v.status !== 'paid' ||
      !['GMD', 'GBP'].includes(text(v.currency))
    )
      throw new AppError('contract');
    text(v._id);
    text(v.ride);
    text(v.paidAt);
    number(v.amount);
    return v as unknown as Payment;
  };
  return {
    nearby: async (
      token: string,
      point: Coordinate,
      signal?: AbortSignal,
    ): Promise<Category[]> => {
      coordinate(point);
      const query = new URLSearchParams({
        lat: String(point[1]),
        lng: String(point[0]),
      });
      const values = await call(
        '/drivers/nearby?' + query,
        'GET',
        undefined,
        token,
        signal,
      );
      if (!Array.isArray(values)) throw new AppError('contract');
      return values.map((value) => {
        const category = record(record(value).vehicle).vehicleType;
        if (!categories.includes(category as Category))
          throw new AppError('contract');
        return category as Category;
      });
    },
    /** Online, approved, free drivers near a point, with their positions. */
    nearbyDrivers: async (
      token: string,
      point: Coordinate,
      signal?: AbortSignal,
    ): Promise<NearbyDriver[]> => {
      coordinate(point);
      const query = new URLSearchParams({
        lat: String(point[1]),
        lng: String(point[0]),
      });
      const values = await call(
        '/drivers/nearby?' + query,
        'GET',
        undefined,
        token,
        signal,
      );
      if (!Array.isArray(values)) throw new AppError('contract');
      return values.map((value) => {
        const v = record(value);
        const category = record(v.vehicle).vehicleType;
        if (!categories.includes(category as Category))
          throw new AppError('contract');
        return {
          id: String(v.driverId),
          point: coordinate(record(v.location).coordinates),
          category: category as Category,
        };
      });
    },
    estimate: async (
      token: string,
      input: Booking,
      signal?: AbortSignal,
    ): Promise<Estimate> => {
      const v = record(
        await call('/rides/estimate', 'POST', input, token, signal),
      );
      if (
        v.currency !== 'GMD' ||
        v.distanceMethod !== 'haversine_straight_line'
      )
        throw new AppError('contract');
      return {
        estimatedFare: number(v.estimatedFare),
        distance: number(v.distance),
        estimatedDuration: number(v.estimatedDuration),
        currency: 'GMD',
        distanceMethod: v.distanceMethod,
      };
    },
    create: async (token: string, input: Booking, signal?: AbortSignal) =>
      trip(await call('/rides', 'POST', input, token, signal)),
    list: async (token: string, signal?: AbortSignal) => {
      const v = await call('/rides/me', 'GET', undefined, token, signal);
      if (!Array.isArray(v)) throw new AppError('contract');
      return v.map(trip);
    },
    detail: async (token: string, id: string, signal?: AbortSignal) =>
      trip(await call(idPath(id), 'GET', undefined, token, signal)),
    cancel: async (
      token: string,
      id: string,
      reason: string,
      signal?: AbortSignal,
    ) => {
      if (!reason.trim() || reason.trim().length > 500)
        throw new AppError('validation');
      return trip(
        await call(
          idPath(id) + '/cancel',
          'PATCH',
          { reason: reason.trim() },
          token,
          signal,
        ),
      );
    },
    payment: async (token: string, id: string, signal?: AbortSignal) => {
      try {
        return payment(
          await call(idPath(id) + '/payment', 'GET', undefined, token, signal),
        );
      } catch (error) {
        if (error instanceof AppError && error.kind === 'unavailable')
          return null;
        throw error;
      }
    },
    pay: async (
      token: string,
      id: string,
      method: Payment['method'],
      signal?: AbortSignal,
    ) =>
      payment(
        await call(idPath(id) + '/payment', 'POST', { method }, token, signal),
      ),
    rate: async (
      token: string,
      id: string,
      rating: number,
      comment: string,
      signal?: AbortSignal,
    ) => {
      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        comment.trim().length > 1000
      )
        throw new AppError('validation');
      await call(
        idPath(id) + '/ratings',
        'POST',
        { rating, comment: comment.trim() },
        token,
        signal,
      );
    },
    share: async (
      token: string,
      id: string,
      signal?: AbortSignal,
    ): Promise<ShareGrant> => {
      const v = record(
        await call(idPath(id) + '/share', 'POST', {}, token, signal),
      );
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(text(v.token)) ||
        !Number.isFinite(Date.parse(text(v.expiresAt))) ||
        v.sharePath !== '/track/' + v.token
      )
        throw new AppError('contract');
      return v as ShareGrant;
    },
    revoke: async (token: string, id: string, signal?: AbortSignal) => {
      await call(idPath(id) + '/share', 'DELETE', undefined, token, signal);
    },
    snapshot: async (token: string, signal?: AbortSignal) => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('unavailable');
      return publicSnapshot(
        await call(
          '/shared-rides/' + token,
          'GET',
          undefined,
          undefined,
          signal,
        ),
      );
    },
  };
}
export type JourneyApi = ReturnType<typeof createJourneyApi>;
