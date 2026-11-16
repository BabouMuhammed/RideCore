import { createTransport, record, type ApiFetch } from './api';
import { AppError } from './errors';
import {
  categories,
  coordinate,
  stop,
  trip,
  type Category,
  type Coordinate,
  type Stop,
  type Trip,
} from './journey-api';

export type Verification = 'pending' | 'approved' | 'rejected';
export type Availability = 'offline' | 'online' | 'busy';
export type DriverProfile = {
  verificationStatus: Verification;
  availabilityStatus: Availability;
  licenseNumber: string | null;
  ratingAverage: number;
  ratingCount: number;
  location: Coordinate | null;
};
export type DriverVehicle = {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  vehicleType: Category;
  seats: number;
  verificationStatus: Verification;
};
export type DriverAccount = {
  profile: DriverProfile | null;
  vehicle: DriverVehicle | null;
};
export type RideRequest = {
  _id: string;
  pickup: Stop;
  destination: Stop;
  distance: number;
  estimatedFare: number;
  currency: string;
  vehicleType: Category;
  requestedAt: string;
};
export type VehicleInput = Omit<DriverVehicle, 'verificationStatus'>;
export type TripAction = 'arriving' | 'arrived' | 'start' | 'complete';

const verifications = ['pending', 'approved', 'rejected'];
const availabilities = ['offline', 'online', 'busy'];
const id = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value))
    throw new AppError('contract');
  return value;
};
const num = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new AppError('contract');
  return value;
};
const str = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('contract');
  return value;
};
function oneOf<T extends string>(value: unknown, allowed: readonly string[]) {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw new AppError('contract');
  return value as T;
}

function profile(value: unknown): DriverProfile | null {
  if (value == null) return null;
  const v = record(value);
  const location = v.currentLocation
    ? coordinate(record(v.currentLocation).coordinates)
    : null;
  return {
    verificationStatus: oneOf<Verification>(v.verificationStatus, verifications),
    availabilityStatus: oneOf<Availability>(v.availabilityStatus, availabilities),
    licenseNumber: typeof v.licenseNumber === 'string' ? v.licenseNumber : null,
    ratingAverage: typeof v.ratingAverage === 'number' ? v.ratingAverage : 0,
    ratingCount: typeof v.ratingCount === 'number' ? v.ratingCount : 0,
    location,
  };
}
function vehicle(value: unknown): DriverVehicle | null {
  if (value == null) return null;
  const v = record(value);
  return {
    make: str(v.make),
    model: str(v.model),
    year: num(v.year),
    color: str(v.color),
    plateNumber: str(v.plateNumber),
    vehicleType: oneOf<Category>(v.vehicleType, categories),
    seats: num(v.seats),
    verificationStatus: oneOf<Verification>(v.verificationStatus, verifications),
  };
}
function request(value: unknown): RideRequest {
  const v = record(value);
  return {
    _id: id(v._id),
    pickup: stop(v.pickup),
    destination: stop(v.destination),
    distance: num(v.distance),
    estimatedFare: num(v.estimatedFare),
    currency: str(v.currency),
    vehicleType: oneOf<Category>(v.vehicleType, categories),
    requestedAt: str(v.requestedAt),
  };
}
/** The rider's first name, as the backend shares it with the assigned driver. */
export function riderName(ride: Trip): string | null {
  const details = ride.riderDetails;
  if (!details || typeof details !== 'object') return null;
  const name = (details as Record<string, unknown>).firstName;
  return typeof name === 'string' && name.trim() ? name : null;
}

export function createDriverApi(
  baseUrl = process.env.EXPO_PUBLIC_API_URL,
  fetcher?: ApiFetch,
) {
  const call = createTransport(baseUrl, fetcher);
  type Signal = AbortSignal | undefined;
  return {
    account: async (token: string, signal?: Signal): Promise<DriverAccount> => {
      const data = record(
        await call('/drivers/me', 'GET', undefined, token, signal),
      );
      return { profile: profile(data.profile), vehicle: vehicle(data.vehicle) };
    },
    saveLicense: async (token: string, licenseNumber: string, signal?: Signal) =>
      profile(
        await call('/drivers/profile', 'PUT', { licenseNumber }, token, signal),
      ),
    saveVehicle: async (token: string, input: VehicleInput, signal?: Signal) =>
      vehicle(await call('/drivers/vehicle', 'PUT', input, token, signal)),
    setLocation: async (token: string, point: Coordinate, signal?: Signal) => {
      await call(
        '/drivers/location',
        'PATCH',
        { type: 'Point', coordinates: coordinate(point) },
        token,
        signal,
      );
    },
    setAvailability: async (
      token: string,
      availabilityStatus: 'online' | 'offline',
      signal?: Signal,
    ) => {
      await call(
        '/drivers/availability',
        'PATCH',
        { availabilityStatus },
        token,
        signal,
      );
    },
    requests: async (token: string, signal?: Signal) => {
      const data = await call(
        '/drivers/ride-requests',
        'GET',
        undefined,
        token,
        signal,
      );
      if (!Array.isArray(data)) throw new AppError('contract');
      return data.map(request);
    },
    rides: async (token: string, signal?: Signal) => {
      const data = await call('/rides/me', 'GET', undefined, token, signal);
      if (!Array.isArray(data)) throw new AppError('contract');
      return data.map(trip);
    },
    ride: async (token: string, rideId: string, signal?: Signal) =>
      trip(await call('/rides/' + id(rideId), 'GET', undefined, token, signal)),
    accept: async (token: string, rideId: string, signal?: Signal) => {
      await call(`/rides/${id(rideId)}/accept`, 'PATCH', undefined, token, signal);
    },
    progress: async (
      token: string,
      rideId: string,
      action: TripAction,
      signal?: Signal,
    ) => {
      await call(`/rides/${id(rideId)}/${action}`, 'PATCH', undefined, token, signal);
    },
    cancel: async (token: string, rideId: string, reason: string, signal?: Signal) => {
      await call(`/rides/${id(rideId)}/cancel`, 'PATCH', { reason }, token, signal);
    },
    rate: async (
      token: string,
      rideId: string,
      rating: number,
      comment: string,
      signal?: Signal,
    ) => {
      await call(
        `/rides/${id(rideId)}/ratings`,
        'POST',
        { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) },
        token,
        signal,
      );
    },
  };
}
export type DriverApi = ReturnType<typeof createDriverApi>;
