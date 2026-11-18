import { render, screen, act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { createJourneyApi } from '../src/services/journey-api';
import { AppError } from '../src/services/errors';
import {
  PublicShareViewer,
  viewerHeadline,
  freshness,
} from '../src/features/sharing/PublicShareViewer';
jest.mock('../src/services/journey-api', () => ({
  ...jest.requireActual('../src/services/journey-api'),
  createJourneyApi: jest.fn(),
}));
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    const handlers = new Map();
    const socket = {
      handlers,
      on: jest.fn((name, handler) => {
        handlers.set(name, handler);
      }),
      connect: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    return socket;
  }),
}));
const snapshot = {
  rideStatus: 'accepted',
  driver: { firstName: 'Synthetic driver', rating: 4 },
  vehicle: null,
  location: null,
  trip: {
    pickup: { address: 'Synthetic pickup', longitude: 0, latitude: 0 },
    destination: {
      address: 'Synthetic destination',
      longitude: 1,
      latitude: 1,
    },
  },
  sharing: { expiresAt: '2099-01-01T00:00:00Z' },
};
const previous = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';
});
afterAll(() => {
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previous;
});
async function mount() {
  await render(
    <SafeAreaProvider>
      <PublicShareViewer token={'s'.repeat(43)} />
    </SafeAreaProvider>,
  );
}
test('recipient needs no rider session and public end notification clears trip information immediately', async () => {
  const api = { snapshot: jest.fn().mockResolvedValue(snapshot) };
  jest
    .mocked(createJourneyApi)
    .mockReturnValue(api as unknown as ReturnType<typeof createJourneyApi>);
  await mount();
  expect(await screen.findByText('Synthetic pickup')).toBeOnTheScreen();
  const socket = jest.mocked(io).mock.results[0]!.value as unknown as {
    handlers: Map<string, () => void>;
  };
  await act(() => socket.handlers.get('share:ended')!());
  expect(await screen.findByText('Sharing has ended')).toBeOnTheScreen();
  expect(screen.queryByText('Synthetic pickup')).not.toBeOnTheScreen();
  expect(io).toHaveBeenCalledWith(
    'https://api.example.test/shared-rides',
    expect.not.objectContaining({ auth: expect.anything() }),
  );
});
test.each(['expired', 'unavailable'] as const)(
  '%s public links never retain trip details',
  async (kind) => {
    const api = { snapshot: jest.fn() };
    if (kind === 'expired')
      api.snapshot.mockResolvedValue({
        ...snapshot,
        sharing: { expiresAt: '2000-01-01T00:00:00Z' },
      });
    else api.snapshot.mockRejectedValue(new AppError('unavailable'));
    jest
      .mocked(createJourneyApi)
      .mockReturnValue(api as unknown as ReturnType<typeof createJourneyApi>);
    await mount();
    expect(await screen.findByText('Sharing has ended')).toBeOnTheScreen();
    expect(screen.queryByText('Synthetic pickup')).not.toBeOnTheScreen();
  },
);
test('public network failure shows retry without exposing a token or backend error', async () => {
  jest.mocked(createJourneyApi).mockReturnValue({
    snapshot: jest.fn().mockRejectedValue(new AppError('network')),
  } as unknown as ReturnType<typeof createJourneyApi>);
  await mount();
  expect(
    await screen.findByRole('button', { name: 'Try again' }),
  ).toBeOnTheScreen();
  expect(screen.queryByText('s'.repeat(43))).not.toBeOnTheScreen();
});
test('public GPS updates are validated and do not issue a REST request for every sample', async () => {
  const api = { snapshot: jest.fn().mockResolvedValue(snapshot) };
  jest
    .mocked(createJourneyApi)
    .mockReturnValue(api as unknown as ReturnType<typeof createJourneyApi>);
  await mount();
  await screen.findByText('Synthetic pickup');
  const socket = jest.mocked(io).mock.results[0]!.value as unknown as {
    handlers: Map<string, (sample: unknown) => void>;
  };
  await act(() =>
    socket.handlers.get('share:location')!({
      longitude: -16.5,
      latitude: 13.4,
      updatedAt: '2026-10-28T12:00:00Z',
    }),
  );
  expect(
    screen.getByText(/Location updated|Last location at/),
  ).toBeOnTheScreen();
  await act(() =>
    socket.handlers.get('share:location')!({
      longitude: 0,
      latitude: 100,
      updatedAt: '2026-10-28T12:01:00Z',
    }),
  );
  expect(api.snapshot).toHaveBeenCalledTimes(1);
});
test('an older persisted public snapshot cannot roll back a newer real socket location', async () => {
  const api = {
    snapshot: jest.fn().mockResolvedValue({
      ...snapshot,
      location: {
        latitude: 0,
        longitude: 0,
        updatedAt: '2026-10-28T12:00:00Z',
      },
    }),
  };
  jest
    .mocked(createJourneyApi)
    .mockReturnValue(api as unknown as ReturnType<typeof createJourneyApi>);
  await mount();
  await screen.findByText('Synthetic pickup');
  const socket = jest.mocked(io).mock.results[0]!.value as unknown as {
    handlers: Map<string, (sample?: unknown) => void>;
  };
  await act(() =>
    socket.handlers.get('share:location')!({
      longitude: 1,
      latitude: 1,
      updatedAt: '2026-10-28T12:00:02Z',
    }),
  );
  const lastUpdate = String(
    screen.getByText(/Location updated|Last location at/).props.children,
  );
  api.snapshot.mockResolvedValue({
    ...snapshot,
    rideStatus: 'driver_arriving',
    location: { longitude: 0, latitude: 0, updatedAt: '2026-10-28T12:00:00Z' },
  });
  await act(() => socket.handlers.get('share:ride-status')!());
  await screen.findByText(/Driver is on the way to pick up/);
  expect(
    screen.getByText(/Location updated|Last location at/),
  ).toHaveTextContent(lastUpdate);
});
test('the page speaks to the person watching and offers emergency numbers', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  jest.mocked(createJourneyApi).mockReturnValue({
    snapshot: jest.fn().mockResolvedValue({
      ...snapshot,
      rideStatus: 'in_progress',
      rider: { firstName: 'Awa' },
    }),
  } as unknown as ReturnType<typeof createJourneyApi>);
  await mount();
  expect(await screen.findByText('Awa’s trip')).toBeOnTheScreen();
  expect(screen.getByText(/^Awa is on the way to /)).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Police · 117' }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Ambulance · 116' }),
  );
  expect(open).toHaveBeenCalledWith('tel:116');
  open.mockRestore();
});
test('viewer wording and freshness', () => {
  const trip = {
    pickup: {
      address: 'Westfield, Serrekunda',
      latitude: 13.4,
      longitude: -16.6,
    },
    destination: {
      address: 'Senegambia, Kololi',
      latitude: 13.4,
      longitude: -16.7,
    },
  };
  expect(viewerHeadline({ rideStatus: 'accepted', trip }, 'Awa')).toBe(
    'Driver is on the way to pick up Awa',
  );
  expect(viewerHeadline({ rideStatus: 'driver_arrived', trip }, null)).toBe(
    'Driver has arrived to pick up the rider',
  );
  expect(viewerHeadline({ rideStatus: 'in_progress', trip }, 'Awa')).toBe(
    'Awa is on the way to Senegambia',
  );
  expect(freshness(12000, '2026-11-18T05:00:00Z')).toBe(
    'Location updated 12 s ago',
  );
  expect(freshness(120000, '2026-11-18T05:00:00Z')).toMatch(
    /^Last location at /,
  );
});
