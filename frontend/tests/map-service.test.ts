import {
  createMapService,
  makeStop,
  shortAddress,
} from '../src/services/geo';

const config = {
  geocoder: 'https://geocoder.example.test',
  router: 'https://router.example.test',
};
function adapter(data: unknown, ok = true) {
  const fetcher = jest
    .fn()
    .mockResolvedValue({ ok, status: ok ? 200 : 429, json: async () => data });
  return { fetcher, api: createMapService(fetcher, config) };
}
const kairaba = {
  lat: '13.4389',
  lon: '-16.6781',
  name: '',
  display_name:
    'Kairaba Avenue, Pipeline, Serrekunda, Kanifing Municipal, Banjul, The Gambia',
  address: {
    road: 'Kairaba Avenue',
    suburb: 'Pipeline',
    city: 'Serrekunda',
    country: 'The Gambia',
  },
};

test('search uses OpenStreetMap Nominatim, limited to The Gambia, with short addresses', async () => {
  const h = adapter([kairaba]);
  expect(await h.api.search('Kairaba Avenue')).toEqual([
    makeStop('Kairaba Avenue, Pipeline, Serrekunda', [-16.6781, 13.4389]),
  ]);
  const url = new URL(h.fetcher.mock.calls[0]![0]);
  expect(url.origin).toBe(config.geocoder);
  expect(url.pathname).toBe('/search');
  expect(url.searchParams.get('countrycodes')).toBe('gm');
  expect(url.searchParams.get('format')).toBe('jsonv2');
  expect(url.searchParams.has('access_token')).toBe(false);
});
test('short queries make no request', async () => {
  const h = adapter([]);
  expect(await h.api.search('ab')).toEqual([]);
  expect(h.fetcher).not.toHaveBeenCalled();
});
test('reverse lookup returns no invented address for an unmapped point', async () => {
  const h = adapter({ error: 'Unable to geocode' });
  expect(await h.api.reverse([-16.5, 13.4])).toBeNull();
  const url = new URL(h.fetcher.mock.calls[0]![0]);
  expect(url.pathname).toBe('/reverse');
  expect(url.searchParams.get('lat')).toBe('13.4');
  expect(url.searchParams.get('lon')).toBe('-16.5');
});
test('named places keep their name first', () => {
  expect(
    shortAddress({
      name: 'Westfield Junction',
      address: { road: 'Kairaba Avenue', city: 'Serrekunda' },
    }),
  ).toBe('Westfield Junction, Kairaba Avenue, Serrekunda');
});
test('overlong names are shortened to fit the 120-character ride address', () => {
  const label = shortAddress({ name: 'x'.repeat(200) });
  expect(label.length).toBeLessThanOrEqual(120);
});
test('road geometry comes from OSRM independently of backend fares', async () => {
  const h = adapter({
    code: 'Ok',
    routes: [
      {
        geometry: {
          coordinates: [
            [-16.5, 13.4],
            [-16.4, 13.5],
          ],
        },
      },
    ],
  });
  expect(await h.api.route([-16.5, 13.4], [-16.4, 13.5])).toEqual([
    [-16.5, 13.4],
    [-16.4, 13.5],
  ]);
  const url = new URL(h.fetcher.mock.calls[0]![0]);
  expect(url.origin).toBe(config.router);
  expect(url.pathname).toBe('/route/v1/driving/-16.5,13.4;-16.4,13.5');
});
test('a route the router cannot find is reported, not invented', async () => {
  await expect(
    adapter({ code: 'NoRoute', routes: [] }).api.route(
      [-16.5, 13.4],
      [-16.4, 13.5],
    ),
  ).rejects.toMatchObject({ kind: 'unavailable' });
});
test.each([
  null,
  { features: [] },
  [{ lat: 'x', lon: '1', display_name: 'Place' }],
  [{ lat: '95', lon: '10', display_name: 'Place' }],
])('malformed geocoding is rejected', async (data) => {
  await expect(adapter(data).api.search('landmark')).rejects.toMatchObject({
    kind: expect.stringMatching(/contract|validation/),
  });
});
test('bad configuration and provider throttling do not generate places', async () => {
  const fetcher = jest.fn();
  await expect(
    createMapService(fetcher, { geocoder: 'ftp://x', router: '' }).search(
      'landmark',
    ),
  ).rejects.toMatchObject({ kind: 'configuration' });
  expect(fetcher).not.toHaveBeenCalled();
  await expect(adapter([], false).api.search('landmark')).rejects.toMatchObject(
    { kind: 'rate' },
  );
});
test('addresses and pins are validated without silently altering digits or text', () => {
  expect(() => makeStop(' ', [0, 0])).toThrow();
  expect(() => makeStop('a'.repeat(121), [0, 0])).toThrow();
  expect(() => makeStop('Place', [0, 95])).toThrow();
});
