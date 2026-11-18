import { gpsHint } from '../src/features/driver/screens/DriveScreen';

test('the driver is told why Go online is waiting and what to do', () => {
  expect(gpsHint('starting')).toMatch(
    /Finding your location… You can also tap the map/,
  );
  expect(gpsHint('watching')).toMatch(/tap the map/);
  expect(gpsHint('denied')).toMatch(/Tap the map where you are/);
  expect(gpsHint('denied')).toMatch(/Use my location/);
  expect(gpsHint('unavailable')).toMatch(/Tap the map where you are/);
});

test('drivers see which requests reach them; bigger cars also take smaller rides', () => {
  const { servedCopy } = jest.requireActual(
    '../src/features/driver/screens/DriveScreen',
  ) as typeof import('../src/features/driver/screens/DriveScreen');
  const { canServe } = jest.requireActual(
    '../src/features/journey/presentation',
  ) as typeof import('../src/features/journey/presentation');
  expect(servedCopy('economy')).toBe('You receive Economy requests');
  expect(servedCopy('comfort')).toBe(
    'You receive Economy and Comfort requests',
  );
  expect(canServe('xl', 'economy')).toBe(true);
  expect(canServe('economy', 'comfort')).toBe(false);
});
