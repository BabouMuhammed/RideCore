import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import App from '../App';

test('demo completes a ride offline, records a sample payment and exits without changing real credentials', async () => {
  const originalMode = process.env.EXPO_PUBLIC_DEMO_MODE;
  process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
  const network = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Demo must work offline'));
  try {
    await render(<App />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Try demo' }),
    );
    await screen.findByText('Where to?');
    jest.mocked(SecureStore.getItemAsync).mockClear();
    jest.mocked(SecureStore.setItemAsync).mockClear();
    jest.mocked(SecureStore.deleteItemAsync).mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Where to?' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Pickup:/ }));
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Senegambia Beach, Kololi, Demo place',
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: /^Destination:/ }),
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Banjul International Airport, Demo place',
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a ride' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Continue' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm ride' }));
    for (const label of [
      'Demo: match a driver',
      'Demo: advance ride',
      'Demo: advance ride',
      'Demo: start ride',
      'Demo: complete ride',
    ]) {
      await fireEvent.press(await screen.findByRole('button', { name: label }));
      if (label === 'Demo: match a driver') {
        await fireEvent.press(
          await screen.findByRole('button', { name: 'Share my ride' }),
        );
        await fireEvent.press(
          screen.getByRole('button', { name: "Preview friend's view" }),
        );
        expect(await screen.findByText("Your friend's view")).toBeOnTheScreen();
        expect(screen.getByText('Driver · Musa')).toBeOnTheScreen();
        expect(
          screen.queryByRole('button', { name: 'Send tracking link' }),
        ).not.toBeOnTheScreen();
        await fireEvent.press(
          screen.getByRole('button', { name: 'Back to trip' }),
        );
      }
    }
    await screen.findByText('Trip receipt');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Record simulated payment' }),
    );
    expect(await screen.findByText(/Payment recorded/)).toBeOnTheScreen();
    expect(network).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Exit demo' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Try demo' }),
      ).toBeOnTheScreen(),
    );
  } finally {
    network.mockRestore();
    if (originalMode === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE;
    else process.env.EXPO_PUBLIC_DEMO_MODE = originalMode;
  }
});
