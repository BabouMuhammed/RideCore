import type { CredentialStore } from '../src/services/credential-store';
import type { RiderApi, User, Ride } from '../src/services/contracts';
import { SessionController } from '../src/features/session/SessionController';
export const national = '99' + '0'.repeat(5);
export const rider: User = {
  _id: '1'.repeat(24),
  firstName: 'Test',
  lastName: 'Rider',
  email: 'rider@example.test',
  phone: '+220' + national,
  role: 'rider',
  isActive: true,
  phoneVerifiedAt: null,
};
export const activeRide: Ride = {
  _id: 'a'.repeat(24),
  rider: rider._id,
  status: 'accepted',
};
export function harness(initialToken: string | null = null) {
  let saved = initialToken;
  const store: jest.Mocked<CredentialStore> = {
    get: jest.fn(async () => saved),
    set: jest.fn(async (token) => {
      saved = token;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
  };
  const api: jest.Mocked<RiderApi> = {
    register: jest.fn<
      ReturnType<RiderApi['register']>,
      Parameters<RiderApi['register']>
    >(async () => rider),
    login: jest.fn<
      ReturnType<RiderApi['login']>,
      Parameters<RiderApi['login']>
    >(async () => ({ token: 'test-only-credential' })),
    me: jest.fn<ReturnType<RiderApi['me']>, Parameters<RiderApi['me']>>(
      async () => rider,
    ),
    rides: jest.fn<
      ReturnType<RiderApi['rides']>,
      Parameters<RiderApi['rides']>
    >(async () => []),
    ride: jest.fn<ReturnType<RiderApi['ride']>, Parameters<RiderApi['ride']>>(
      async () => activeRide,
    ),
    requestOtp: jest.fn<
      ReturnType<RiderApi['requestOtp']>,
      Parameters<RiderApi['requestOtp']>
    >(async () => ({
      expiresInSeconds: 300,
      mockCode: '000000',
    })),
    verifyOtp: jest.fn<
      ReturnType<RiderApi['verifyOtp']>,
      Parameters<RiderApi['verifyOtp']>
    >(async () => undefined),
  };
  const controller = new SessionController(api, store);
  return { api, store, controller, saved: () => saved };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
