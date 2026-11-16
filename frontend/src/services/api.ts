import type {
  Credentials,
  OtpReply,
  Registration,
  Ride,
  RiderApi,
  User,
} from './contracts';
import { acceptableApiUrl, apiUrl } from './server-config';
import { rideStatuses } from './contracts';
import { AppError } from './errors';
type RecordValue = Record<string, unknown>;
export function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError('contract');
  return value as RecordValue;
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new AppError('contract');
  return value;
}
function user(value: unknown): User {
  const v = record(value);
  if (
    typeof v.isActive !== 'boolean' ||
    !(v.phoneVerifiedAt === null || typeof v.phoneVerifiedAt === 'string')
  )
    throw new AppError('contract');
  return {
    _id: text(v._id),
    firstName: text(v.firstName),
    lastName: text(v.lastName),
    email: text(v.email),
    phone: text(v.phone),
    role: text(v.role),
    isActive: v.isActive,
    phoneVerifiedAt: v.phoneVerifiedAt,
  };
}
export function ride(value: unknown): Ride {
  const v = record(value);
  if (
    !rideStatuses.includes(v.status as Ride['status']) ||
    !/^[a-f0-9]{24}$/i.test(text(v._id))
  )
    throw new AppError('contract');
  return {
    ...v,
    _id: text(v._id),
    rider: text(v.rider),
    status: v.status as Ride['status'],
  };
}
export type ApiFetch = (
  url: string,
  options?: RequestInit,
) => Promise<Response>;
export function createTransport(
  baseUrl = apiUrl(),
  fetcher: ApiFetch = (url, options) => fetch(url, options),
) {
  async function call(
    path: string,
    method: string,
    input?: unknown,
    token?: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!baseUrl) throw new AppError('configuration');
    // Release builds allow plain http only to the local network (a laptop
    // on the same Wi-Fi); public addresses must use https.
    const normalizedBase = acceptableApiUrl(baseUrl);
    if (!normalizedBase) throw new AppError('configuration');
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal?.addEventListener('abort', cancel);
    if (signal?.aborted) abort.abort();
    const timeout = setTimeout(cancel, 15000);
    try {
      const response = await fetcher(normalizedBase + path, {
        method,
        signal: abort.signal,
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          ...(input !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(input !== undefined ? { body: JSON.stringify(input) } : {}),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (response.ok) throw new AppError('contract');
      }
      if (!response.ok) {
        const retry = response.headers.get('Retry-After');
        const seconds =
          retry && /^\d+$/.test(retry)
            ? Number(retry)
            : retry
              ? Math.max(0, Math.ceil((Date.parse(retry) - Date.now()) / 1000))
              : undefined;
        const message =
          body && typeof body === 'object'
            ? (body as { error?: { message?: unknown } }).error?.message
            : undefined;
        if (response.status === 401)
          throw new AppError(
            path === '/auth/login' ? 'credentials' : 'unauthenticated',
          );
        if (response.status === 429)
          throw new AppError(
            message === 'Please wait before requesting another code'
              ? 'cooldown'
              : 'rate',
            Number.isFinite(seconds) ? seconds : undefined,
          );
        if (response.status >= 500) throw new AppError('server');
        if (response.status === 404) throw new AppError('unavailable');
        if (response.status === 409 && !path.startsWith('/auth/'))
          throw new AppError('changed');
        if (path === '/auth/otp/verify') throw new AppError('otp');
        // On ride and driver routes a 403 is about this ride or approval,
        // not the account type, so it must not sign the user out.
        if (
          response.status === 403 &&
          (path.startsWith('/drivers') || path.startsWith('/rides'))
        )
          throw new AppError(
            message === 'Approved driver profile and vehicle required'
              ? 'approval'
              : 'forbidden',
          );
        if (response.status === 403) throw new AppError('role');
        if (response.status === 409 && path === '/auth/register')
          throw new AppError('conflict');
        if (response.status === 400 || response.status === 409)
          throw new AppError('validation');
        throw new AppError('contract');
      }
      const envelope = record(body);
      if (envelope.success !== true || envelope.data === undefined)
        throw new AppError('contract');
      return envelope.data;
    } catch (error) {
      if (signal?.aborted) throw new AppError('cancelled');
      if (error instanceof AppError) throw error;
      throw new AppError('network');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    }
  }
  return call;
}
export function createApi(
  baseUrl = apiUrl(),
  fetcher?: ApiFetch,
): RiderApi {
  const call = createTransport(baseUrl, fetcher);
  return {
    register: async (input: Registration, signal) =>
      user(
        await call(
          '/auth/register',
          'POST',
          {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            password: input.password,
            accountType: input.accountType,
          },
          undefined,
          signal,
        ),
      ),
    login: async (input: Credentials, signal) => ({
      token: text(
        record(await call('/auth/login', 'POST', input, undefined, signal))
          .token,
      ),
    }),
    me: async (token, signal) =>
      user(await call('/auth/me', 'GET', undefined, token, signal)),
    rides: async (token, signal) => {
      const data = await call('/rides/me', 'GET', undefined, token, signal);
      if (!Array.isArray(data)) throw new AppError('contract');
      return data.map(ride);
    },
    ride: async (token, id, signal) => {
      if (!/^[a-f0-9]{24}$/i.test(id)) throw new AppError('contract');
      return ride(await call('/rides/' + id, 'GET', undefined, token, signal));
    },
    requestOtp: async (token, signal): Promise<OtpReply> => {
      const data = record(
        await call('/auth/otp/request', 'POST', {}, token, signal),
      );
      if (
        typeof data.expiresInSeconds !== 'number' ||
        data.expiresInSeconds <= 0 ||
        data.expiresInSeconds > 600 ||
        (data.mockCode !== undefined &&
          (typeof data.mockCode !== 'string' || !/^\d{6}$/.test(data.mockCode)))
      )
        throw new AppError('contract');
      return {
        expiresInSeconds: data.expiresInSeconds,
        ...(typeof data.mockCode === 'string'
          ? { mockCode: data.mockCode }
          : {}),
      };
    },
    verifyOtp: async (token, code, signal) => {
      if (!/^\d{6}$/.test(code)) throw new AppError('otp');
      await call('/auth/otp/verify', 'POST', { code }, token, signal);
    },
  };
}
