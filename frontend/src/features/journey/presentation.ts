import type { Trip } from '../../services/journey-api';
export const statusLabels: Record<Trip['status'], string> = {
  requested: 'Finding your driver',
  accepted: 'Driver matched',
  driver_arriving: 'Your driver is approaching',
  driver_arrived: 'Your driver has arrived',
  in_progress: 'On your way',
  completed: 'You’ve arrived',
  cancelled: 'Ride cancelled',
};
export const noDriverFound = 'no_driver_found';
export const requestTimeoutSeconds = 60;
export function headline(trip: Pick<Trip, 'status' | 'cancellationReason'>) {
  return trip.status === 'cancelled' &&
    trip.cancellationReason === noDriverFound
    ? 'No driver found'
    : statusLabels[trip.status];
}
export function money(amount: number, currency = 'GMD') {
  return `${currency} ${amount.toFixed(2)}`;
}
export const cancellationReasons = [
  'Booked by mistake',
  'Driver too far',
  'Driver not moving toward me',
  'Driver asked me to cancel',
  'Wait too long',
  'Changed plans',
  'Found another ride',
  'Wrong pickup/destination',
  'Other',
];
