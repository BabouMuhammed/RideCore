import {
  decisionHint,
  decisionLabel,
} from '../src/features/admin/AdminScreens';

test('the current decision is named, not offered as an action', () => {
  expect(decisionLabel('profile', 'approved', 'approved')).toBe(
    'Profile approved (current)',
  );
  expect(decisionLabel('profile', 'rejected', 'approved')).toBe(
    'Reject profile',
  );
  expect(decisionLabel('vehicle', 'approved', 'pending')).toBe(
    'Approve vehicle',
  );
  expect(decisionLabel('vehicle', 'suspended', 'suspended')).toBe(
    'Vehicle suspended (current)',
  );
});

test('hints say what each state means and how to change it', () => {
  expect(decisionHint('Profile', 'approved')).toBe(
    'Profile is approved. Choose Reject or Suspend to change it.',
  );
  expect(decisionHint('Profile', 'rejected')).toMatch(/Approve it/);
  expect(decisionHint('Vehicle', 'suspended')).toMatch(/restore driving/);
  expect(decisionHint('Vehicle', 'pending')).toBe(
    'Vehicle is waiting for a decision.',
  );
});
