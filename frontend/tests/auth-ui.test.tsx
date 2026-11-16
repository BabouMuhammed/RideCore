import {
  render,
  screen,
  userEvent,
  fireEvent,
} from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider } from '../src/features/session/SessionProvider';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { harness, rider, national, activeRide } from './fixtures';
import { AppError } from '../src/services/errors';
jest.mock('../src/services/journey-api', () => ({
  ...jest.requireActual('../src/services/journey-api'),
  createJourneyApi: () => {
    const { journeyApi, tripFixture } =
      jest.requireActual('./journey-fixtures');
    const api = journeyApi();
    api.detail.mockImplementation(async (_token: string, id: string) => ({
      ...tripFixture,
      _id: id,
    }));
    return api;
  },
}));
// Use RNTL's supported timer driver for realistic presses/typing without wall-clock delays.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
function interactions() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

export function testApp(h: ReturnType<typeof harness>) {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <SessionProvider controller={h.controller}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
async function signInForm(h: ReturnType<typeof harness>) {
  await render(testApp(h));
  await interactions().press(
    await screen.findByRole('button', { name: 'Sign in' }),
  );
}
test('registration submits exact fields and confirms creation without authenticating', async () => {
  const h = harness();
  const user = interactions();
  await render(testApp(h));
  await user.press(
    await screen.findByRole('button', { name: 'Get started' }),
  );
  for (const [label, value] of [
    ['First name', ' Test '],
    ['Last name', ' Rider '],
    ['Email', 'RIDER@example.test'],
    ['Phone number', national],
    ['Password', 'test-only-password'],
  ])
    await fireEvent.changeText(screen.getByLabelText(label!), value!);
  await user.press(screen.getByRole('button', { name: 'Create account' }));
  expect(
    await screen.findByRole('header', { name: 'Account created' }),
  ).toBeOnTheScreen();
  expect(h.api.register).toHaveBeenCalledWith({
    firstName: 'Test',
    lastName: 'Rider',
    email: 'rider@example.test',
    phone: rider.phone,
    password: 'test-only-password',
    accountType: 'rider',
  });
  expect(h.store.set).not.toHaveBeenCalled();
  expect(h.controller.getSnapshot().stage).toBe('anonymous');
  await user.press(screen.getByRole('button', { name: 'Continue to sign in' }));
  expect(await screen.findByLabelText('Email')).toHaveDisplayValue(
    'rider@example.test',
  );
});
test('invalid registration stays in the form and never calls the backend', async () => {
  const h = harness();
  const user = interactions();
  await render(testApp(h));
  await user.press(
    await screen.findByRole('button', { name: 'Get started' }),
  );
  await user.press(screen.getByRole('button', { name: 'Create account' }));
  expect(
    await screen.findByText('Enter a name between 1 and 120 characters.'),
  ).toBeOnTheScreen();
  expect(h.api.register).not.toHaveBeenCalled();
});
test.each(['email', 'phone'] as const)(
  'real %s sign-in reaches the rider shell after bootstrap',
  async (mode) => {
    const h = harness();
    const user = interactions();
    await signInForm(h);
    if (mode === 'phone')
      await user.press(screen.getByRole('radio', { name: 'Use phone number' }));
    await fireEvent.changeText(
      screen.getByLabelText(mode === 'email' ? 'Email' : 'Phone number'),
      mode === 'email' ? 'RIDER@example.test' : national,
    );
    await fireEvent.changeText(
      screen.getByLabelText('Password'),
      'test-only-password',
    );
    await user.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Where to?')).toBeOnTheScreen();
    expect(h.api.login).toHaveBeenCalledWith(
      mode === 'email'
        ? { email: rider.email, password: 'test-only-password' }
        : { phone: rider.phone, password: 'test-only-password' },
      expect.any(AbortSignal),
    );
  },
);
test('incorrect credentials remain safe inline feedback', async () => {
  const h = harness();
  h.api.login.mockRejectedValue(new AppError('credentials'));
  const user = interactions();
  await signInForm(h);
  await fireEvent.changeText(screen.getByLabelText('Email'), rider.email);
  await fireEvent.changeText(
    screen.getByLabelText('Password'),
    'test-only-password',
  );
  await user.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(
    await screen.findByText(
      'The email or phone number and password do not match.',
    ),
  ).toBeOnTheScreen();
  expect(h.store.set).not.toHaveBeenCalled();
});
test('password visibility is an explicit accessible action', async () => {
  const h = harness();
  const user = interactions();
  await signInForm(h);
  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  await user.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password')).toHaveProp(
    'secureTextEntry',
    false,
  );
});
test('network restoration provides retry without deleting the credential', async () => {
  const h = harness('credential');
  h.api.me.mockRejectedValueOnce(new AppError('network'));
  const user = interactions();
  await render(testApp(h));
  expect(
    await screen.findByText(
      'Unable to connect. Check your connection and try again.',
    ),
  ).toBeOnTheScreen();
  expect(h.saved()).toBe('credential');
  await user.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Where to?')).toBeOnTheScreen();
});
test('restored active ride enters the real requested state without driver lifecycle actions', async () => {
  const h = harness('credential');
  h.api.rides.mockResolvedValue([activeRide]);
  await render(testApp(h));
  expect(await screen.findByText('Finding your driver')).toBeOnTheScreen();
  expect(h.controller.getSnapshot()).toMatchObject({ activeRide });
});
test('an admin account gets a clear role rejection instead of rider tabs', async () => {
  const h = harness('credential');
  h.api.me.mockResolvedValue({ ...rider, role: 'admin' });
  await render(testApp(h));
  expect(
    await screen.findByText('Rider or driver account required'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Where to?')).not.toBeOnTheScreen();
});

test('account opens authenticated phone verification and logout returns to authentication', async () => {
  const h = harness('credential');
  const user = interactions();
  await render(testApp(h));
  await screen.findByText('Where to?');
  await user.press(screen.getByRole('tab', { name: /Account/ }));
  await user.press(
    await screen.findByRole('button', { name: /Verify phone number/ }),
  );
  expect(
    await screen.findByRole('header', { name: 'Verify your phone' }),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Go back' }));
  await user.press(
    await screen.findByRole('button', { name: 'Sign out on this device' }),
  );
  await user.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(
    await screen.findByRole('button', { name: 'Sign in' }),
  ).toBeOnTheScreen();
  expect(h.saved()).toBeNull();
  expect(h.controller.getSnapshot()).not.toHaveProperty('user');
});
