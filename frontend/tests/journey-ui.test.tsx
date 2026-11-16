import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Platform, Share } from 'react-native';
import { SessionProvider } from '../src/features/session/SessionProvider';
import { JourneyProvider } from '../src/features/journey/JourneyProvider';
import {
  JourneyController,
  type Runner,
} from '../src/features/journey/JourneyController';
import { BookingHome } from '../src/features/home/screens/BookingHome';
import { Receipt } from '../src/features/receipt/Receipt';
import { SharePanel, recipientUrl } from '../src/features/sharing/SharePanel';
import { AddressPicker } from '../src/features/map/AddressPicker';
import { harness, rider, deferred } from './fixtures';
import type { Trip } from '../src/services/journey-api';
import { journeyApi, tripFixture as trip } from './journey-fixtures';
import { AppError } from '../src/services/errors';
jest.mock('../src/services/mapbox', () => ({
  ...jest.requireActual('../src/services/mapbox'),
  createMapService: () => {
    const { tripFixture } = jest.requireActual('./journey-fixtures');
    return {
      search: async (query: string) => [
        query.toLowerCase().includes('pickup')
          ? tripFixture.pickup
          : tripFixture.destination,
      ],
      reverse: async () => null,
      route: async () => [
        tripFixture.pickup.location.coordinates,
        tripFixture.destination.location.coordinates,
      ],
    };
  },
}));
function fixture() {
  const api = journeyApi(),
    close = jest.fn();
  const run: Runner = (work) =>
    work('test-only-credential', new AbortController().signal);
  const controller = new JourneyController(
    api,
    run,
    rider._id,
    null,
    () => close,
  );
  return { api, controller, close };
}
async function mount(h: ReturnType<typeof fixture>, child: React.ReactNode) {
  return render(
    <SafeAreaProvider>
      <SessionProvider controller={harness('credential').controller}>
        <JourneyProvider controller={h.controller}>{child}</JourneyProvider>
      </SessionProvider>
    </SafeAreaProvider>,
  );
}
test('real booking interactions select addresses, request server fares and create only on confirmation', async () => {
  const h = fixture();
  await mount(h, <BookingHome />);
  expect(await screen.findByText('Where to?')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Where to?' }));
  await waitFor(() => expect(h.controller.getSnapshot().loading).toBe(false));
  for (const kind of ['Pickup', 'Destination']) {
    await fireEvent.press(
      screen.getByRole('button', { name: new RegExp('^' + kind + ',') }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Search address or landmark'),
      kind + ' landmark',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Search places' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Synthetic ' + kind.toLowerCase(),
      }),
    );
  }
  await fireEvent.press(screen.getByRole('button', { name: 'See fares' }));
  await screen.findByRole('button', { name: 'Continue with this ride' });
  expect(h.api.estimate).toHaveBeenCalledTimes(3);
  expect(h.api.create).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Continue with this ride' }),
  );
  expect(h.api.create).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Request ride' }));
  expect(await screen.findByText('Connecting to a driver')).toBeOnTheScreen();
  expect(h.api.create).toHaveBeenCalledWith(
    'test-only-credential',
    {
      pickup: trip.pickup,
      destination: trip.destination,
      vehicleType: 'economy',
    },
    expect.any(AbortSignal),
  );
  expect(screen.queryByText('Driver matched')).not.toBeOnTheScreen();
});
test('cancellation requires selecting a reason and explicit confirmation', async () => {
  const h = fixture();
  h.api.list.mockResolvedValue([trip]);
  await mount(h, <BookingHome />);
  await screen.findByText('Connecting to a driver');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel ride' }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Changed plans' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(h.api.cancel).not.toHaveBeenCalled();
  h.api.list.mockResolvedValue([{ ...trip, status: 'cancelled' }]);
  h.api.detail.mockResolvedValue({ ...trip, status: 'cancelled' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Confirm cancellation' }),
  );
  expect(await screen.findByText('Ride cancelled')).toBeOnTheScreen();
  expect(h.api.cancel).toHaveBeenCalledWith(
    'test-only-credential',
    trip._id,
    'Changed plans',
    expect.any(AbortSignal),
  );
});
test('in-progress UI cannot offer cancellation or driver transitions', async () => {
  const h = fixture();
  h.api.list.mockResolvedValue([{ ...trip, status: 'in_progress' }]);
  h.api.detail.mockResolvedValue({ ...trip, status: 'in_progress' });
  await mount(h, <BookingHome />);
  await screen.findByText('On your way');
  expect(
    screen.queryByRole('button', { name: 'Cancel ride' }),
  ).not.toBeOnTheScreen();
  expect(
    screen.queryByRole('button', {
      name: /Start ride|Complete ride|Accept ride/,
    }),
  ).not.toBeOnTheScreen();
});
test('receipt records an actual API result and then a bounded rating', async () => {
  const h = fixture();
  await mount(
    h,
    <Receipt
      trip={{ ...trip, status: 'completed', finalFare: 125 }}
      onUpdated={jest.fn()}
    />,
  );
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Record simulated payment' }),
  );
  expect(await screen.findByText(/Payment recorded/)).toBeOnTheScreen();
  expect(h.api.pay).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: 'Record simulated payment' }),
  ).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '5 stars' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Submit rating' }));
  expect(
    await screen.findByText('Thank you. Your rating has been recorded.'),
  ).toBeOnTheScreen();
  expect(h.api.rate).toHaveBeenCalledWith(
    'test-only-credential',
    trip._id,
    5,
    '',
    expect.any(AbortSignal),
  );
});
test('denied foreground permission still permits address search and manual map selection', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    granted: false,
  } as Location.LocationPermissionResponse);
  const h = fixture(),
    confirm = jest.fn();
  await mount(
    h,
    <AddressPicker
      kind="pickup"
      pin={null}
      onPin={jest.fn()}
      onConfirm={confirm}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Use my current location' }),
  );
  expect(
    await screen.findByText(/Location permission is off/),
  ).toBeOnTheScreen();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText('Search address or landmark'),
    'Pickup landmark',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Search places' }));
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Synthetic pickup' }),
  );
  expect(confirm).toHaveBeenCalledWith(trip.pickup);
});
test('share URLs use a bearer fragment; revocation stays available even if no local grant is retained', async () => {
  const url = new URL(
    recipientUrl('s'.repeat(43), 'https://viewer.example.test')!,
  );
  expect(url.search).toBe('');
  expect(url.hash).toBe('#track=' + 's'.repeat(43));
  expect(
    recipientUrl('s'.repeat(43), 'https://user:password@viewer.example.test'),
  ).toBeNull();
  const h = fixture();
  await mount(
    h,
    <SharePanel trip={{ ...trip, status: 'accepted' }} onClose={jest.fn()} />,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Stop sharing this ride' }),
  );
  await waitFor(() =>
    expect(h.api.revoke).toHaveBeenCalledWith(
      'test-only-credential',
      trip._id,
      expect.any(AbortSignal),
    ),
  );
  expect(
    await screen.findByText('Sharing has been stopped for this ride.'),
  ).toBeOnTheScreen();
});
test('Share my ride sends one backend link, retains it when reopened, and revokes it', async () => {
  const previous = process.env.EXPO_PUBLIC_SHARE_WEB_URL;
  process.env.EXPO_PUBLIC_SHARE_WEB_URL = 'https://tracking.example.test';
  const send = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  try {
    const h = fixture();
    const active = {
      ...trip,
      status: 'accepted' as const,
      driver: 'e'.repeat(24),
    };
    h.api.list.mockResolvedValue([active]);
    h.api.detail.mockResolvedValue(active);
    h.api.share.mockResolvedValue({
      token: 's'.repeat(43),
      sharePath: '/track/' + 's'.repeat(43),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    await mount(h, <BookingHome />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Share my ride' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create tracking link' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Send tracking link' }),
    );
    expect(send).toHaveBeenCalledWith({
      message:
        'Follow my RideCore ride. No account needed: https://tracking.example.test/#track=' +
        's'.repeat(43),
    });
    expect(h.api.share).toHaveBeenCalledWith(
      'test-only-credential',
      trip._id,
      expect.any(AbortSignal),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back to trip' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Share my ride' }),
    );
    expect(
      screen.getByRole('button', { name: 'Send tracking link' }),
    ).toBeOnTheScreen();
    expect(h.api.share).toHaveBeenCalledTimes(1);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Stop sharing this ride' }),
    );
    expect(
      await screen.findByText('Sharing has been stopped for this ride.'),
    ).toBeOnTheScreen();
    expect(h.api.revoke).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Send tracking link' }),
    ).not.toBeOnTheScreen();
  } finally {
    send.mockRestore();
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SHARE_WEB_URL;
    else process.env.EXPO_PUBLIC_SHARE_WEB_URL = previous;
  }
});

test('browser tracking links can be copied without creating another grant', async () => {
  const previous = process.env.EXPO_PUBLIC_SHARE_WEB_URL;
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText } },
  });
  process.env.EXPO_PUBLIC_SHARE_WEB_URL = 'https://tracking.example.test';
  try {
    const h = fixture();
    await mount(
      h,
      <SharePanel
        trip={{ ...trip, status: 'accepted' }}
        initialGrant={{
          token: 's'.repeat(43),
          sharePath: '/track/' + 's'.repeat(43),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Copy tracking link' }),
    );
    expect(writeText).toHaveBeenCalledWith(
      'https://tracking.example.test/#track=' + 's'.repeat(43),
    );
    expect(await screen.findByText(/Tracking link copied/)).toBeOnTheScreen();
    expect(h.api.share).not.toHaveBeenCalled();
  } finally {
    platform.restore();
    if (originalNavigator)
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SHARE_WEB_URL;
    else process.env.EXPO_PUBLIC_SHARE_WEB_URL = previous;
  }
});

test('uncertain share creation requires revocation before retrying without sending a guessed link', async () => {
  const previous = process.env.EXPO_PUBLIC_SHARE_WEB_URL;
  process.env.EXPO_PUBLIC_SHARE_WEB_URL = 'https://tracking.example.test';
  try {
    const h = fixture();
    h.api.share.mockRejectedValueOnce(new AppError('network'));
    await mount(
      h,
      <SharePanel trip={{ ...trip, status: 'accepted' }} onClose={jest.fn()} />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create tracking link' }),
    );
    expect(
      await screen.findByText(
        /We could not confirm whether the link was created/,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Create tracking link' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Send tracking link' }),
    ).not.toBeOnTheScreen();
    expect(h.api.share).toHaveBeenCalledTimes(1);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Stop sharing this ride' }),
    );
    await screen.findByText('Sharing has been stopped for this ride.');
    expect(
      screen.getByRole('button', { name: 'Create tracking link' }),
    ).not.toBeDisabled();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SHARE_WEB_URL;
    else process.env.EXPO_PUBLIC_SHARE_WEB_URL = previous;
  }
});

test('an uncertain payment response recovers the server record rather than claiming failure or paying again', async () => {
  const h = fixture();
  h.api.payment.mockResolvedValueOnce(null).mockResolvedValueOnce({
    _id: 'c'.repeat(24),
    ride: trip._id,
    method: 'cash',
    amount: 125,
    currency: 'GMD',
    status: 'paid',
    paidAt: trip.requestedAt,
  });
  h.api.pay.mockRejectedValueOnce(new AppError('network'));
  await mount(
    h,
    <Receipt
      trip={{ ...trip, status: 'completed', finalFare: 125 }}
      onUpdated={jest.fn()}
    />,
  );
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Record simulated payment' }),
  );
  expect(await screen.findByText(/Payment recorded/)).toBeOnTheScreen();
  expect(
    screen.queryByText(
      'Unable to connect. Check your connection and try again.',
    ),
  ).not.toBeOnTheScreen();
  expect(h.api.pay).toHaveBeenCalledTimes(1);
});
test('late completed state replaces active sheet without offering active-only actions', async () => {
  const h = fixture();
  h.api.list.mockResolvedValue([trip]);
  await mount(h, <BookingHome />);
  await screen.findByText('Connecting to a driver');
  h.api.list.mockResolvedValue([{ ...trip, status: 'completed' }]);
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'completed',
    finalFare: 125,
  });
  await act(() => h.controller.refresh());
  expect(await screen.findByText('You’ve arrived')).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Cancel ride' }),
  ).not.toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Share my ride' }),
  ).not.toBeOnTheScreen();
});
test('journey bootstrap shows loading instead of offering booking before active-ride discovery', async () => {
  const h = fixture(),
    gate = deferred<Trip[]>();
  h.api.list.mockReturnValue(gate.promise);
  await mount(h, <BookingHome />);
  expect(await screen.findByText('Restoring your journey')).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'See fares' }),
  ).not.toBeOnTheScreen();
  await act(async () => {
    gate.resolve([trip]);
    await h.controller.refresh();
  });
  expect(await screen.findByText('Connecting to a driver')).toBeOnTheScreen();
});
test('authoritative active-ride reconciliation supersedes an open address-selection sheet', async () => {
  const h = fixture();
  await mount(h, <BookingHome />);
  await waitFor(() => expect(h.controller.getSnapshot().loading).toBe(false));
  await fireEvent.press(screen.getByRole('button', { name: 'Where to?' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Pickup,/ }));
  expect(screen.getByLabelText('Search address or landmark')).toBeOnTheScreen();
  h.api.list.mockResolvedValue([trip]);
  await act(() => h.controller.refresh());
  expect(await screen.findByText('Connecting to a driver')).toBeOnTheScreen();
  expect(
    screen.queryByLabelText('Search address or landmark'),
  ).not.toBeOnTheScreen();
});
