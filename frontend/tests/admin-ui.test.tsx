import {
  render,
  screen,
  fireEvent,
  waitFor,
  userEvent,
} from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/features/session/SessionProvider';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { harness, rider, deferred } from './fixtures';
import { AppError } from '../src/services/errors';
import type { AdminApi } from '../src/services/admin-api';

const profileId = '2'.repeat(24),
  vehicleId = '3'.repeat(24),
  userId = '4'.repeat(24);
const overview = {
  registeredRiders: 78,
  registeredDrivers: 2,
  pendingDriverApprovals: 1,
  onlineDrivers: 0,
  activeRides: 1,
  completedRides: 6,
  cancelledRides: 2,
  recordedPayments: 5,
};
const mockApi = {
  overview: jest.fn(),
  drivers: jest.fn(),
  users: jest.fn(),
  rides: jest.fn(),
  payments: jest.fn(),
  ride: jest.fn(),
  verify: jest.fn(),
  setActive: jest.fn(),
};
jest.mock('../src/services/admin-api', () => ({
  createAdminApi: () => mockApi,
}));
const user = {
  ...rider,
  _id: userId,
  firstName: 'Review',
  lastName: 'Driver',
  role: 'driver',
};
const trip = {
  _id: '5'.repeat(24),
  rider: rider._id,
  driver: userId,
  status: 'completed',
  pickup: 'Westfield Junction',
  destination: 'Serrekunda Market',
  currency: 'GMD',
  fare: 150,
  riderName: 'Test',
  driverName: 'Review',
  vehicleType: 'economy',
  timestamps: [{ label: 'requested', value: '2026-11-17T00:00:00Z' }],
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockApi.overview.mockResolvedValue(overview);
  mockApi.drivers.mockResolvedValue([
    {
      _id: profileId,
      user: userId,
      account: user,
      licenseNumber: 'TEST-LICENCE',
      verificationStatus: 'pending',
      availabilityStatus: 'offline',
      vehicle: {
        _id: vehicleId,
        make: 'Toyota',
        model: 'Corolla',
        verificationStatus: 'pending',
      },
    },
  ]);
  mockApi.users.mockResolvedValue([user]);
  mockApi.rides.mockResolvedValue([trip]);
  mockApi.ride.mockResolvedValue(trip);
  mockApi.payments.mockResolvedValue([
    {
      _id: '6'.repeat(24),
      ride: trip._id,
      method: 'mock_wallet',
      status: 'pending',
      amount: 150,
      currency: 'GMD',
      transactionReference: 'SIM-test',
    },
  ]);
  mockApi.verify.mockResolvedValue(undefined);
  mockApi.setActive.mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());
function app(h: ReturnType<typeof harness>) {
  return (
    <SafeAreaProvider>
      <SessionProvider controller={h.controller}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
async function adminApp() {
  const h = harness('credential');
  h.api.me.mockResolvedValue({ ...rider, role: 'admin' });
  await render(app(h));
  await screen.findByText('Administration');
  return h;
}
const interactions = () =>
  userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

test('admin form rejects rider credentials in place and never stores them', async () => {
  const h = harness();
  await render(app(h));
  await interactions().press(
    await screen.findByRole('button', { name: 'Admin sign in' }),
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), rider.email);
  await fireEvent.changeText(
    screen.getByLabelText('Password'),
    'test-password',
  );
  await interactions().press(
    screen.getByRole('button', { name: 'Sign in as administrator' }),
  );
  expect(
    await screen.findByText(
      'Use an active administrator account to sign in here.',
    ),
  ).toBeOnTheScreen();
  expect(h.store.set).not.toHaveBeenCalled();
  expect(mockApi.overview).not.toHaveBeenCalled();
  expect(screen.queryByText('Administration')).not.toBeOnTheScreen();
});
test('admin form authenticates into the dashboard and administrator logout clears the session', async () => {
  const h = harness();
  h.api.me.mockResolvedValue({ ...rider, role: 'admin' });
  await render(app(h));
  await interactions().press(
    await screen.findByRole('button', { name: 'Admin sign in' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('Email'),
    'admin@example.test',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password'),
    'test-password',
  );
  await interactions().press(
    screen.getByRole('button', { name: 'Sign in as administrator' }),
  );
  expect(await screen.findByText('Administration')).toBeOnTheScreen();
  expect(h.api.rides).not.toHaveBeenCalled();
  await interactions().press(screen.getByRole('button', { name: 'Sign out' }));
  await interactions().press(
    await screen.findByRole('button', { name: 'Confirm sign out' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Admin sign in' }),
  ).toBeOnTheScreen();
  expect(h.saved()).toBeNull();
  expect(screen.queryByText('Administration')).not.toBeOnTheScreen();
});
test('admin navigates real records across all sections and inspects trip details', async () => {
  const h = await adminApp();
  expect(
    await screen.findByRole('button', { name: 'Registered riders: 78' }),
  ).toBeOnTheScreen();
  expect(h.api.rides).not.toHaveBeenCalled();
  const input = interactions();
  await input.press(screen.getByRole('tab', { name: /Rides/ }));
  await input.press(
    await screen.findByRole('button', { name: `View trip ${trip._id}` }),
  );
  expect(await screen.findByText('Review')).toBeOnTheScreen();
  await input.press(screen.getByRole('button', { name: 'Back to rides' }));
  await input.press(screen.getByRole('tab', { name: /Users/ }));
  expect(await screen.findByText('Review Driver')).toBeOnTheScreen();
  await input.press(screen.getByRole('tab', { name: /Payments/ }));
  expect(
    await screen.findByText('Mock wallet · Simulated record'),
  ).toBeOnTheScreen();
  expect(await screen.findByText('Pending')).toBeOnTheScreen();
  await input.press(screen.getByRole('tab', { name: /Drivers/ }));
  expect(
    await screen.findByText('Profile: Pending · Offline'),
  ).toBeOnTheScreen();
});
test('profile and vehicle approvals use separate IDs, confirmation and a locked mutation', async () => {
  await adminApp();
  const input = interactions();
  await input.press(screen.getByRole('tab', { name: /Drivers/ }));
  await input.press(
    await screen.findByRole('button', { name: /Review application Review/ }),
  );
  await input.press(screen.getByRole('button', { name: 'Approve profile' }));
  const gate = deferred<void>();
  mockApi.verify.mockReturnValueOnce(gate.promise);
  await input.press(
    await screen.findByRole('button', { name: 'Confirm change' }),
  );
  expect(screen.getByRole('button', { name: 'Confirm change' })).toBeDisabled();
  gate.resolve();
  await waitFor(() => expect(mockApi.verify).toHaveBeenCalledTimes(1));
  await screen.findByText('Change saved. Records refreshed.');
  await input.press(
    await screen.findByRole('button', { name: 'Approve vehicle' }),
  );
  await input.press(
    await screen.findByRole('button', { name: 'Confirm change' }),
  );
  await waitFor(() => expect(mockApi.verify).toHaveBeenCalledTimes(2));
  expect(
    mockApi.verify.mock.calls.map((call) => [call[1], call[2], call[3]]),
  ).toEqual([
    ['drivers', profileId, 'approved'],
    ['vehicles', vehicleId, 'approved'],
  ]);
});
test('account management invokes the authorized activation operation', async () => {
  await adminApp();
  const input = interactions();
  await input.press(screen.getByRole('tab', { name: /Users/ }));
  await input.press(
    await screen.findByRole('button', { name: 'Disable account' }),
  );
  await input.press(
    await screen.findByRole('button', { name: 'Confirm change' }),
  );
  await waitFor(() =>
    expect(mockApi.setActive).toHaveBeenCalledWith(
      'credential',
      userId,
      false,
      expect.any(AbortSignal),
    ),
  );
});
test('dashboard failure stays unknown until retry succeeds', async () => {
  mockApi.overview.mockRejectedValueOnce(new AppError('network'));
  await adminApp();
  expect(
    await screen.findByText(
      'Unable to connect. Check your connection and try again.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: /Registered riders:/ }),
  ).not.toBeOnTheScreen();
  await interactions().press(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByRole('button', { name: 'Registered riders: 78' }),
  ).toBeOnTheScreen();
});
test('a late dashboard response cannot reappear after logout', async () => {
  const gate = deferred<Awaited<ReturnType<AdminApi['overview']>>>();
  mockApi.overview.mockReturnValueOnce(gate.promise);
  const h = await adminApp();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Confirm sign out' }),
  );
  await screen.findByRole('button', { name: 'Admin sign in' });
  gate.resolve(overview);
  await waitFor(() => expect(h.saved()).toBeNull());
  expect(
    screen.queryByRole('button', { name: 'Registered riders: 78' }),
  ).not.toBeOnTheScreen();
});
