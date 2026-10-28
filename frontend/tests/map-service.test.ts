import { createMapService, makeStop } from '../src/services/mapbox';
const geometry = { type: 'Point', coordinates: [-16.5, 13.4] };
function adapter(data: unknown, ok = true) {
  const fetcher = jest
    .fn()
    .mockResolvedValue({ ok, status: ok ? 200 : 429, json: async () => data });
  return { fetcher, api: createMapService(fetcher, 'pk.synthetic-test-only') };
}
test('search uses permanent geocoding for stored ride addresses and preserves geometry', async () => {
  const h = adapter({
    features: [
      { geometry, properties: { full_address: 'Synthetic landmark' } },
    ],
  });
  expect(await h.api.search('Synthetic landmark')).toEqual([
    makeStop('Synthetic landmark', [-16.5, 13.4]),
  ]);
  const url = new URL(h.fetcher.mock.calls[0]![0]);
  expect(url.pathname).toBe('/search/geocode/v6/forward');
  expect(url.searchParams.get('permanent')).toBe('true');
  expect(url.searchParams.get('country')).toBe('gm');
});
test('reverse lookup returns no invented address for an empty result', async () => {
  const h = adapter({ features: [] });
  expect(await h.api.reverse([-16.5, 13.4])).toBeNull();
  expect(
    new URL(h.fetcher.mock.calls[0]![0]).searchParams.get('permanent'),
  ).toBe('true');
});
test('road geometry is parsed independently of backend fares', async () => {
  const h = adapter({
    routes: [
      {
        geometry: {
          coordinates: [
            [-16.5, 13.4],
            [-16.4, 13.5],
          ],
        },
        duration: 100,
        distance: 200,
      },
    ],
  });
  expect(await h.api.route([-16.5, 13.4], [-16.4, 13.5])).toEqual([
    [-16.5, 13.4],
    [-16.4, 13.5],
  ]);
});
test.each([
  null,
  { features: 'invalid' },
  {
    features: [
      {
        geometry: { coordinates: [200, 10] },
        properties: { full_address: 'Place' },
      },
    ],
  },
])('malformed geocoding is rejected', async (data) => {
  await expect(adapter(data).api.search('landmark')).rejects.toMatchObject({
    kind: 'contract',
  });
});
test('missing configuration and provider failure do not generate places or routes', async () => {
  const fetcher = jest.fn();
  await expect(
    createMapService(fetcher, '').search('landmark'),
  ).rejects.toMatchObject({ kind: 'configuration' });
  expect(fetcher).not.toHaveBeenCalled();
  await expect(adapter({}, false).api.search('landmark')).rejects.toMatchObject(
    { kind: 'rate' },
  );
});
test('addresses and pins are validated without silently altering digits or text', () => {
  expect(() => makeStop(' ', [0, 0])).toThrow();
  expect(() => makeStop('a'.repeat(121), [0, 0])).toThrow();
  expect(() => makeStop('Place', [0, 95])).toThrow();
});
