import { render, screen, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { createJourneyApi } from '../src/services/journey-api';
import { AppError } from '../src/services/errors';
import { PublicShareViewer } from '../src/features/sharing/PublicShareViewer';
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
  expect(
    await screen.findByText('Pickup · Synthetic pickup'),
  ).toBeOnTheScreen();
  const socket = jest.mocked(io).mock.results[0]!.value as unknown as {
    handlers: Map<string, () => void>;
  };
  await act(() => socket.handlers.get('share:ended')!());
  expect(
    await screen.findByText('Sharing has ended or this link is unavailable.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Pickup · Synthetic pickup')).not.toBeOnTheScreen();
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
    expect(
      await screen.findByText('Sharing has ended or this link is unavailable.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('Pickup · Synthetic pickup'),
    ).not.toBeOnTheScreen();
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
