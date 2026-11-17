import { createTransport, record, text, type ApiFetch } from './api';
import { apiUrl } from './server-config';
import { AppError } from './errors';
import { rideStatuses, type RideStatus } from './contracts';
import type { Verification } from './driver-api';

export type AdminOverview = {
  registeredRiders: number;
  registeredDrivers: number;
  pendingDriverApprovals: number;
  onlineDrivers: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  recordedPayments: number;
};
export type AdminUser = {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  email?: string;
  phone?: string;
};
export type AdminVehicle = {
  _id: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  plateNumber?: string;
  vehicleType?: string;
  seats?: number;
  verificationStatus: Verification;
};
export type AdminDriver = {
  _id: string;
  user: string;
  licenseNumber?: string;
  verificationStatus: Verification;
  availabilityStatus: string;
  account: AdminUser | null;
  vehicle: AdminVehicle | null;
};
export type AdminRide = {
  _id: string;
  rider: string;
  driver?: string;
  status: RideStatus;
  pickup: string;
  destination: string;
  vehicleType?: string;
  fare?: number;
  currency: string;
  riderName?: string;
  driverName?: string;
  vehicle?: string;
  timestamps: { label: string; value: string }[];
};
export type AdminPayment = {
  _id: string;
  ride: string;
  method: string;
  status: string;
  amount: number;
  currency: string;
  transactionReference: string;
  paidAt?: string;
  createdAt?: string;
};
function id(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{24}$/i.test(result)) throw new AppError('contract');
  return result;
}
const optionalText = (v: unknown) =>
  typeof v === 'string' && v ? v : undefined;
const optionalNumber = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new AppError('contract');
  return value;
}
function verification(value: unknown): Verification {
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(text(value)))
    throw new AppError('contract');
  return value as Verification;
}
function user(value: unknown): AdminUser {
  const v = record(value);
  return {
    _id: id(v._id),
    firstName: text(v.firstName),
    lastName: text(v.lastName),
    role: text(v.role),
    isActive: boolean(v.isActive),
    email: optionalText(v.email),
    phone: optionalText(v.phone),
  };
}
function driver(value: unknown): AdminDriver {
  const v = record(value),
    car = v.vehicle == null ? null : record(v.vehicle);
  return {
    _id: id(v._id),
    user: id(v.user),
    licenseNumber: optionalText(v.licenseNumber),
    verificationStatus: verification(v.verificationStatus),
    availabilityStatus: text(v.availabilityStatus),
    account:
      v.account == null ? null : user({ ...record(v.account), role: 'driver' }),
    vehicle: car
      ? {
          _id: id(car._id),
          make: text(car.make),
          model: text(car.model),
          year: optionalNumber(car.year),
          color: optionalText(car.color),
          plateNumber: optionalText(car.plateNumber),
          vehicleType: optionalText(car.vehicleType),
          seats: optionalNumber(car.seats),
          verificationStatus: verification(car.verificationStatus),
        }
      : null,
  };
}
const currency = (v: unknown) => {
  if (v == null) return 'GBP'; // Existing legacy-record convention; no conversion.
  if (v !== 'GBP' && v !== 'GMD') throw new AppError('contract');
  return v;
};
function ride(value: unknown): AdminRide {
  const v = record(value),
    status = text(v.status);
  if (!rideStatuses.includes(status as RideStatus))
    throw new AppError('contract');
  const person = (p: unknown) =>
    p == null ? undefined : optionalText(record(p).firstName);
  const car = v.vehicle == null ? null : record(v.vehicle);
  const timeFields = [
    'requestedAt',
    'acceptedAt',
    'arrivingAt',
    'arrivedAt',
    'startedAt',
    'completedAt',
    'cancelledAt',
  ];
  return {
    _id: id(v._id),
    rider: id(v.rider),
    driver: v.driver == null ? undefined : id(v.driver),
    status: status as RideStatus,
    pickup: text(record(v.pickup).address),
    destination: text(record(v.destination).address),
    vehicleType: optionalText(v.vehicleType),
    fare: optionalNumber(v.finalFare) ?? optionalNumber(v.estimatedFare),
    currency: currency(v.currency),
    riderName: person(v.riderDetails),
    driverName: person(v.driverDetails),
    vehicle: car
      ? [car.color, car.make, car.model, car.plateNumber]
          .filter((x) => typeof x === 'string')
          .join(' ')
      : undefined,
    timestamps: timeFields.flatMap((key) =>
      typeof v[key] === 'string'
        ? [{ label: key.replace(/At$/, ''), value: v[key] as string }]
        : [],
    ),
  };
}
function payment(value: unknown): AdminPayment {
  const v = record(value),
    amount = optionalNumber(v.amount);
  if (
    amount === undefined ||
    amount < 0 ||
    !['pending', 'paid', 'failed', 'refunded'].includes(text(v.status)) ||
    !['cash', 'mock_wallet'].includes(text(v.method))
  )
    throw new AppError('contract');
  return {
    _id: id(v._id),
    ride: id(v.ride),
    amount,
    currency: currency(v.currency),
    status: text(v.status),
    method: text(v.method),
    transactionReference: text(v.transactionReference),
    paidAt: optionalText(v.paidAt),
    createdAt: optionalText(v.createdAt),
  };
}
export function createAdminApi(base = apiUrl(), fetcher?: ApiFetch) {
  const call = createTransport(base, fetcher);
  async function list<T>(
    kind: string,
    parser: (v: unknown) => T,
    token: string,
    page: number,
    signal?: AbortSignal,
  ) {
    if (!Number.isSafeInteger(page) || page < 1) throw new AppError('contract');
    const data = await call(
      `/admin/${kind}?page=${page}`,
      'GET',
      undefined,
      token,
      signal,
    );
    if (!Array.isArray(data)) throw new AppError('contract');
    return data.map(parser);
  }
  return {
    overview: async (
      token: string,
      signal?: AbortSignal,
    ): Promise<AdminOverview> => {
      const v = record(
        await call('/admin/overview', 'GET', undefined, token, signal),
      );
      const keys = [
        'registeredRiders',
        'registeredDrivers',
        'pendingDriverApprovals',
        'onlineDrivers',
        'activeRides',
        'completedRides',
        'cancelledRides',
        'recordedPayments',
      ] as const;
      const result = {} as AdminOverview;
      for (const key of keys) {
        if (
          typeof v[key] !== 'number' ||
          !Number.isSafeInteger(v[key]) ||
          v[key] < 0
        )
          throw new AppError('contract');
        result[key] = v[key];
      }
      return result;
    },
    users: (t: string, page: number, s?: AbortSignal) =>
      list('users', user, t, page, s),
    drivers: (t: string, page: number, s?: AbortSignal) =>
      list('drivers', driver, t, page, s),
    rides: (t: string, page: number, s?: AbortSignal) =>
      list('rides', ride, t, page, s),
    payments: (t: string, page: number, s?: AbortSignal) =>
      list('payments', payment, t, page, s),
    ride: async (t: string, rideId: string, s?: AbortSignal) =>
      ride(await call(`/rides/${id(rideId)}`, 'GET', undefined, t, s)),
    verify: async (
      t: string,
      kind: 'drivers' | 'vehicles',
      resourceId: string,
      status: Exclude<Verification, 'pending'>,
      s?: AbortSignal,
    ) => {
      await call(
        `/admin/${kind}/${id(resourceId)}/verification`,
        'PATCH',
        { verificationStatus: status },
        t,
        s,
      );
    },
    setActive: async (
      t: string,
      userId: string,
      isActive: boolean,
      s?: AbortSignal,
    ) => {
      await call(
        `/admin/users/${id(userId)}/active`,
        'PATCH',
        { isActive },
        t,
        s,
      );
    },
  };
}
export type AdminApi = ReturnType<typeof createAdminApi>;
