import * as SecureStore from 'expo-secure-store';
import { credentialStore } from '../src/services/credential-store.web';
import { SessionController } from '../src/features/session/SessionController';
import { harness, rider } from './fixtures';

const key = 'ridecore.rider.credential';
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
let values: Map<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => values.set(name, value),
      removeItem: (name: string) => values.delete(name),
    },
  });
});

afterEach(() => {
  if (originalStorage)
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('web preview stores and removes only its credential without native SecureStore', async () => {
  values.set('unrelated', 'preserved');
  expect(await credentialStore.get()).toBeNull();
  await credentialStore.set('test-only-credential');
  expect(values.get(key)).toBe('test-only-credential');
  expect(await credentialStore.get()).toBe('test-only-credential');
  await credentialStore.clear();
  expect(await credentialStore.get()).toBeNull();
  expect(values.get('unrelated')).toBe('preserved');
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('empty browser storage naturally reaches unauthenticated bootstrap', async () => {
  const { api } = harness();
  const controller = new SessionController(api, credentialStore);
  await controller.restore();
  expect(controller.getSnapshot()).toEqual({ stage: 'anonymous' });
  expect(api.me).not.toHaveBeenCalled();
  expect(api.rides).not.toHaveBeenCalled();
});

test('stored browser credential still requires server identity and ride discovery; logout removes it', async () => {
  const { api } = harness();
  await credentialStore.set('test-only-credential');
  const controller = new SessionController(api, credentialStore);
  await controller.restore();
  expect(api.me).toHaveBeenCalledWith(
    'test-only-credential',
    expect.any(AbortSignal),
  );
  expect(api.rides).toHaveBeenCalledWith(
    'test-only-credential',
    expect.any(AbortSignal),
  );
  expect(api.me.mock.invocationCallOrder[0]).toBeLessThan(
    api.rides.mock.invocationCallOrder[0]!,
  );
  expect(controller.getSnapshot()).toEqual({
    stage: 'ready',
    user: rider,
    activeRide: null,
  });
  await controller.logout();
  expect(await credentialStore.get()).toBeNull();
  expect(controller.getSnapshot().stage).toBe('anonymous');
});

test.each(['get', 'set', 'clear'] as const)(
  'blocked browser storage rejects %s rather than hiding the failure',
  async (operation) => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('Browser storage denied');
      },
    });
    const result =
      operation === 'set'
        ? credentialStore.set('test-only-credential')
        : credentialStore[operation]();
    await expect(result).rejects.toThrow('Browser storage denied');
  },
);
