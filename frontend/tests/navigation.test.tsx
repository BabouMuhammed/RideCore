import { SessionProvider } from '../src/features/session/SessionProvider';
import { harness } from './fixtures';
import {
  render,
  screen,
  fireEvent,
  userEvent,
} from '@testing-library/react-native';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from '../App';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from '../src/navigation/RootNavigator';
jest.mock('../src/services/journey-api', () => ({
  ...jest.requireActual('../src/services/journey-api'),
  createJourneyApi: () => jest.requireActual('./journey-fixtures').journeyApi(),
}));

test('launch shows the real entry flow without an authenticated bypass', async () => {
  await render(<App />);
  expect(await screen.findByText('RideCore')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.queryByText('Activity')).not.toBeOnTheScreen();
  expect(screen.queryByText('Account')).not.toBeOnTheScreen();
});
test('native splash hides after the application root lays out', async () => {
  await render(<App />);
  await fireEvent(screen.getByTestId('application-root'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 844, x: 0, y: 0 } },
  });
  expect(SplashScreen.hideAsync).toHaveBeenCalled();
});
test('sign-in route is a real credential form and back returns to welcome', async () => {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(await screen.findByRole('button', { name: 'Sign in' }));
  expect(await screen.findByLabelText('Password')).toBeOnTheScreen();
  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  await user.press(screen.getByRole('button', { name: 'Go back' }));
  expect(
    await screen.findByRole('button', { name: 'Get started' }),
  ).toBeOnTheScreen();
});
test('registration has its own route and collects only the required fields', async () => {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(
    await screen.findByRole('button', { name: 'Get started' }),
  );
  expect(await screen.findByLabelText('Password')).toBeOnTheScreen();
  expect(screen.getByLabelText('Email')).toBeOnTheScreen();
  expect(screen.getByLabelText('Phone number')).toBeOnTheScreen();
  expect(screen.getByLabelText('First name')).toBeOnTheScreen();
  expect(screen.getByLabelText('Last name')).toBeOnTheScreen();
});
test('the authenticated rider shell connects real Home, Activity and Account', async () => {
  const user = userEvent.setup();
  // Direct component mounting validates structure; no user-facing bypass exists.
  await render(
    <SafeAreaProvider>
      <SessionProvider controller={harness('credential').controller}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText('Where to?')).toBeOnTheScreen();
  for (let visit = 0; visit < 2; visit++) {
    await user.press(
      screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', {
        name: /Services/,
      }),
    );
    await user.press(await screen.findByRole('button', { name: 'Comfort' }));
    expect(await screen.findByText('Where to?')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Back to home' }));
    expect(await screen.findByText('Where to?')).toBeOnTheScreen();
  }
  await user.press(
    screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', {
      name: /Activity/,
    }),
  );
  expect(
    await screen.findByText('Your recent rides, as recorded by RideCore.'),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', {
      name: /Account/,
    }),
  );
  expect(await screen.findByText('Your RideCore account')).toBeOnTheScreen();
});
