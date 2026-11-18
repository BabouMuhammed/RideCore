import { render, screen, fireEvent } from '@testing-library/react-native';
import { TripAlert, tripAlert } from '../src/features/notifications/TripAlert';
import type { Trip } from '../src/services/journey-api';

const base = {
  _id: 'a'.repeat(24),
  driverDetails: {
    firstName: 'Lamin',
    rating: 4.8,
    verificationStatus: 'approved',
  },
  vehicle: {
    make: 'Nissan',
    model: 'Sunny',
    color: 'White',
    plateNumber: 'BJL2290A',
    vehicleType: 'economy',
    seats: 4,
    verificationStatus: 'approved',
  },
} as unknown as Trip;
const at = (status: Trip['status']) => ({ ...base, status }) as Trip;

test('alert copy names the driver and the car', () => {
  expect(tripAlert(at('accepted'))).toMatchObject({
    title: 'Lamin is on the way',
    body: 'Look out for the White Nissan Sunny.',
  });
  expect(tripAlert(at('driver_arrived'))?.title).toBe(
    'Your driver has arrived',
  );
  expect(tripAlert(at('in_progress'))).toBeNull();
});

test('shows when the driver arrives, not for the status the app opened on', async () => {
  const view = await render(<TripAlert trip={at('accepted')} />);
  expect(screen.queryByText('Lamin is on the way')).toBeNull();
  await view.rerender(<TripAlert trip={at('driver_arriving')} />);
  await view.rerender(<TripAlert trip={at('driver_arrived')} />);
  expect(screen.getByText('Your driver has arrived')).toBeTruthy();
  expect(screen.getByLabelText('Plate number BJL2290A')).toBeTruthy();
  await fireEvent.press(screen.getByText('I’m on my way'));
  expect(screen.queryByText('Your driver has arrived')).toBeNull();
});

test('announces the driver when a request is accepted', async () => {
  const view = await render(<TripAlert trip={at('requested')} />);
  await view.rerender(<TripAlert trip={at('accepted')} />);
  expect(screen.getByText('Lamin is on the way')).toBeTruthy();
});
