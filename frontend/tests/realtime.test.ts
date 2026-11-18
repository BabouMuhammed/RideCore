import { io } from 'socket.io-client';
import {
  watchRide,
  rideEvents,
  watchDriverRequests,
} from '../src/services/realtime';
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const emit = jest.fn((_name, _payload, reply) =>
      reply(null, { success: true }),
    );
    const socket = {
      active: true,
      handlers,
      on: jest.fn((name, handler) => {
        handlers.set(name, handler);
      }),
      timeout: jest.fn(() => ({ emit })),
      emit,
      connect: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    return socket;
  }),
}));
const previous = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';
});
afterAll(() => {
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previous;
});
function harness() {
  const handlers = {
    changed: jest.fn(),
    connection: jest.fn(),
    location: jest.fn(),
  };
  const close = watchRide('test-only-credential', 'a'.repeat(24), handlers);
  const socket = jest.mocked(io).mock.results[0]!.value as unknown as {
    active: boolean;
    handlers: Map<string, (...args: unknown[]) => void>;
    emit: jest.Mock;
    disconnect: jest.Mock;
    removeAllListeners: jest.Mock;
  };
  return { handlers, socket, close };
}
test('every socket connection authenticates, rejoins the ride and reconciles REST', () => {
  const h = harness();
  expect(io).toHaveBeenCalledWith(
    'https://api.example.test',
    expect.objectContaining({
      auth: { token: 'test-only-credential' },
      forceNew: true,
    }),
  );
  h.socket.handlers.get('connect')!();
  h.socket.handlers.get('connect')!();
  expect(h.socket.emit).toHaveBeenCalledTimes(2);
  expect(h.socket.emit).toHaveBeenCalledWith(
    'ride:join',
    { rideId: 'a'.repeat(24) },
    expect.any(Function),
  );
  expect(h.handlers.changed).toHaveBeenCalledTimes(2);
  expect(h.handlers.connection).toHaveBeenLastCalledWith(true);
  h.close();
  expect(h.socket.removeAllListeners).toHaveBeenCalled();
  expect(h.socket.disconnect).toHaveBeenCalled();
});
test('only matching ride events and valid real tracking samples are forwarded', () => {
  const h = harness();
  for (const event of rideEvents)
    h.socket.handlers.get(event)!({ rideId: 'a'.repeat(24) });
  expect(h.handlers.changed).toHaveBeenCalledTimes(6);
  h.socket.handlers.get('ride:accepted')!({ rideId: 'b'.repeat(24) });
  expect(h.handlers.changed).toHaveBeenCalledTimes(6);
  const location = h.socket.handlers.get('driver:location')!;
  location({
    rideId: 'a'.repeat(24),
    latitude: 100,
    longitude: 0,
    timestamp: '2026-10-28T12:00:00Z',
  });
  location({
    rideId: 'a'.repeat(24),
    latitude: 0,
    longitude: 0,
    timestamp: 'invalid',
  });
  expect(h.handlers.location).not.toHaveBeenCalled();
  location({
    rideId: 'a'.repeat(24),
    latitude: 13.4,
    longitude: -16.5,
    timestamp: '2026-10-28T12:00:00Z',
  });
  expect(h.handlers.location).toHaveBeenCalledWith({
    point: [-16.5, 13.4],
    timestamp: '2026-10-28T12:00:00Z',
  });
});
test('server disconnection triggers authoritative credential/status recovery without faking a ride state', () => {
  const h = harness();
  h.socket.handlers.get('connect_error')!(new Error('Network unavailable'));
  expect(h.handlers.changed).not.toHaveBeenCalled();
  h.socket.active = false;
  h.socket.handlers.get('disconnect')!();
  expect(h.handlers.connection).toHaveBeenCalledWith(false);
  expect(h.handlers.changed).toHaveBeenCalledTimes(1);
  h.socket.handlers.get('connect_error')!({ data: { status: 401 } });
  expect(h.handlers.changed).toHaveBeenCalledTimes(2);
});
test('online drivers refetch requests the instant the server says they changed', () => {
  const changed = jest.fn();
  const close = watchDriverRequests('test-only-credential', changed);
  const socket = jest.mocked(io).mock.results[0]!.value as unknown as {
    handlers: Map<string, (...args: unknown[]) => void>;
    connect: jest.Mock;
    disconnect: jest.Mock;
  };
  expect(io).toHaveBeenCalledWith(
    'https://api.example.test',
    expect.objectContaining({ auth: { token: 'test-only-credential' } }),
  );
  expect(socket.connect).toHaveBeenCalled();
  socket.handlers.get('requests:changed')!({});
  expect(changed).toHaveBeenCalledTimes(1);
  // A reconnect also refetches, covering anything missed meanwhile.
  socket.handlers.get('connect')!();
  expect(changed).toHaveBeenCalledTimes(2);
  close();
  expect(socket.disconnect).toHaveBeenCalled();
});
