import { gpsHint } from '../src/features/driver/screens/DriveScreen';

test('the driver is told why Go online is waiting and what to do', () => {
  expect(gpsHint('starting')).toBe('Finding your location…');
  expect(gpsHint('denied')).toMatch(/Tap the map where you are/);
  expect(gpsHint('denied')).toMatch(/Use my location/);
  expect(gpsHint('unavailable')).toMatch(/Tap the map where you are/);
});
