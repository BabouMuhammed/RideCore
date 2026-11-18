import { latestBundle } from '../src/application/appUpdates.web';

test('finds the deployed web bundle in index.html', () => {
  expect(
    latestBundle(
      '<script src="/_expo/static/js/web/index-abc123.js" defer></script>',
    ),
  ).toBe('/_expo/static/js/web/index-abc123.js');
  expect(latestBundle('<html>no bundle</html>')).toBeNull();
});
