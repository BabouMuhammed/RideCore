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
