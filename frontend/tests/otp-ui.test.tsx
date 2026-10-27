import { act, render, screen, userEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SessionProvider } from '../src/features/session/SessionProvider';
import { PhoneVerificationScreen } from '../src/features/auth/screens/PhoneVerificationScreen';
import type { RiderStackParams } from '../src/navigation/types';
import { harness, rider } from './fixtures';
import { AppError } from '../src/services/errors';
const Stack = createNativeStackNavigator<RiderStackParams>();
async function setupOtp(h = harness('credential')) {
  await h.controller.restore();
  await render(
    <SafeAreaProvider>
      <SessionProvider controller={h.controller}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="PhoneVerification"
              component={PhoneVerificationScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>,
  );
  await screen.findByRole('button', { name: 'Request verification code' });
  return h;
}
afterEach(() => jest.useRealTimers());
test('mock OTP request is honest, masked and enforces resend guard', async () => {
  const h = await setupOtp();
  const user = userEvent.setup();
  expect(screen.getByText(/No SMS is sent/)).toBeOnTheScreen();
  expect(screen.queryByText(rider.phone)).not.toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', { name: 'Request verification code' }),
  );
  expect(
    await screen.findByText('Use this simulated code: 000000'),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Request another code' }),
  ).toBeDisabled();
  expect(h.api.requestOtp).toHaveBeenCalledTimes(1);
});
test('six digits are required before verification and successful verification refreshes me', async () => {
  const h = await setupOtp();
  const user = userEvent.setup();
  await user.press(
    screen.getByRole('button', { name: 'Request verification code' }),
  );
  await user.type(await screen.findByLabelText('Verification code'), '123');
  await user.press(screen.getByRole('button', { name: 'Verify phone' }));
  expect(
    screen.getByText('Enter the six-digit verification code.'),
  ).toBeOnTheScreen();
  expect(h.api.verifyOtp).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText('Verification code'));
  await user.type(screen.getByLabelText('Verification code'), '000000');
  h.api.me.mockResolvedValue({
    ...rider,
    phoneVerifiedAt: '2026-10-27T00:00:00Z',
  });
  await user.press(screen.getByRole('button', { name: 'Verify phone' }));
  expect(
    await screen.findByRole('header', { name: 'Phone verified' }),
  ).toBeOnTheScreen();
  expect(h.api.verifyOtp).toHaveBeenCalledWith(
    'credential',
    '000000',
    expect.any(AbortSignal),
  );
});
test('server TTL expires the challenge and prevents submitting an expired code', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const h = harness('credential');
  h.api.requestOtp.mockResolvedValue({
    expiresInSeconds: 30,
    mockCode: '000000',
  });
  await setupOtp(h);
  await user.press(
    screen.getByRole('button', { name: 'Request verification code' }),
  );
  await act(() => {
    jest.advanceTimersByTime(31000);
  });
  expect(screen.getByText('This code has expired.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Verify phone' })).toBeDisabled();
  expect(h.api.verifyOtp).not.toHaveBeenCalled();
});
test('server cooldown feedback honors a longer Retry-After value', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const h = harness('credential');
  h.api.requestOtp.mockRejectedValue(new AppError('cooldown', 120));
  await setupOtp(h);
  await user.press(
    screen.getByRole('button', { name: 'Request verification code' }),
  );
  expect(
    screen.getByText(
      'Please wait before requesting another verification code.',
    ),
  ).toBeOnTheScreen();
  await act(() => {
    jest.advanceTimersByTime(61000);
  });
  expect(
    screen.getByRole('button', { name: 'Request verification code' }),
  ).toBeDisabled();
  await act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(
    screen.getByRole('button', { name: 'Request verification code' }),
  ).toBeEnabled();
});
test('production response without a mock code does not fabricate delivery or a code', async () => {
  const h = harness('credential');
  h.api.requestOtp.mockResolvedValue({ expiresInSeconds: 300 });
  await setupOtp(h);
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Request verification code' }));
  expect(
    await screen.findByText(/No simulated code is available/),
  ).toBeOnTheScreen();
  expect(
    screen.queryByText('Use this simulated code: 000000'),
  ).not.toBeOnTheScreen();
});
test('wrong/expired/attempt-exhausted code is safe error feedback, not fake verification', async () => {
  const h = harness('credential');
  h.api.verifyOtp.mockRejectedValue(new AppError('otp'));
  await setupOtp(h);
  const user = userEvent.setup();
  await user.press(
    screen.getByRole('button', { name: 'Request verification code' }),
  );
  await user.type(await screen.findByLabelText('Verification code'), '000000');
  await user.press(screen.getByRole('button', { name: 'Verify phone' }));
  expect(
    await screen.findByText(
      'The code is incorrect, expired or no longer available. Request a new code when available.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('header', { name: 'Phone verified' }),
  ).not.toBeOnTheScreen();
});
