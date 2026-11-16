export type User = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  phoneVerifiedAt: string | null;
};
export const activeStatuses = [
  'requested',
  'accepted',
  'driver_arriving',
  'driver_arrived',
  'in_progress',
] as const;
export const rideStatuses = [
  ...activeStatuses,
  'completed',
  'cancelled',
] as const;
export type RideStatus = (typeof rideStatuses)[number];
export type Ride = {
  _id: string;
  rider: string;
  status: RideStatus;
  [key: string]: unknown;
};
export type Registration = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: 'rider' | 'driver';
};
export type Credentials =
  { email: string; password: string } | { phone: string; password: string };
export type OtpReply = { expiresInSeconds: number; mockCode?: string };
export interface RiderApi {
  register(input: Registration, signal?: AbortSignal): Promise<User>;
  login(input: Credentials, signal?: AbortSignal): Promise<{ token: string }>;
  me(token: string, signal?: AbortSignal): Promise<User>;
  rides(token: string, signal?: AbortSignal): Promise<Ride[]>;
  ride(token: string, id: string, signal?: AbortSignal): Promise<Ride>;
  requestOtp(token: string, signal?: AbortSignal): Promise<OtpReply>;
  verifyOtp(token: string, code: string, signal?: AbortSignal): Promise<void>;
}
