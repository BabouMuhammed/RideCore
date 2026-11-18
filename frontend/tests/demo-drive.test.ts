import { samplePath } from '../src/features/driver/demoDrive';

test('the demo drive moves in even steps and ends exactly at the target', () => {
  const path: [number, number][] = [
    [-16.676, 13.446],
    [-16.67, 13.446],
    [-16.67, 13.44],
  ];
  const points = samplePath(path, 10);
  expect(points).toHaveLength(10);
  expect(points.at(-1)).toEqual([-16.67, 13.44]);
  // Moves forward along the path (longitude first, then latitude).
  expect(points[0]![0]).toBeGreaterThan(-16.676);
  expect(points[9]![1]).toBeLessThan(points[4]![1]);
});

test('a drive lasts between 20 and 60 steps', () => {
  expect(
    samplePath([
      [-16.676, 13.446],
      [-16.6759, 13.446],
    ]),
  ).toHaveLength(20);
  expect(
    samplePath([
      [-16.9, 13.4],
      [-16.5, 13.4],
    ]),
  ).toHaveLength(60);
});
