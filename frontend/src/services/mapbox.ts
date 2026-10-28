import { coordinate, type Coordinate, type Stop } from './journey-api';
import { record, text } from './api';
import { AppError } from './errors';

export const mapToken = () => process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
export const initialCenter: Coordinate = [-16.579, 13.454]; // Region, never claimed as rider GPS.
export function makeStop(address: string, coordinates: Coordinate): Stop {
  if (!address.trim() || address.trim().length > 120)
    throw new AppError('validation');
  return {
    address: address.trim(),
    location: { type: 'Point', coordinates: coordinate(coordinates) },
  };
}
export function createMapService(
  fetcher: typeof fetch = fetch,
  token = mapToken(),
) {
  async function request(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ) {
    if (!token?.startsWith('pk.')) throw new AppError('configuration');
    const query = new URLSearchParams({ ...params, access_token: token });
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal?.addEventListener('abort', cancel);
    if (signal?.aborted) abort.abort();
    const timer = setTimeout(cancel, 15000);
    try {
      const response = await fetcher(
        'https://api.mapbox.com/' + path + '?' + query,
        { signal: abort.signal, referrerPolicy: 'no-referrer' },
      );
      if (!response.ok)
        throw new AppError(response.status === 429 ? 'rate' : 'server');
      return record(await response.json());
    } catch (error) {
      if (signal?.aborted) throw new AppError('cancelled');
      throw error instanceof AppError ? error : new AppError('network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  function places(data: Record<string, unknown>): Stop[] {
    if (!Array.isArray(data.features)) throw new AppError('contract');
    return data.features.map((feature: unknown) => {
      const v = record(feature),
        props = record(v.properties),
        geometry = record(v.geometry);
      // Permanent geocoding is required because confirmed results are stored in rides.
      // No truncation of an address: overlong results require a user-entered landmark.
      return makeStop(
        text(props.full_address),
        coordinate(geometry.coordinates),
      );
    });
  }
  return {
    search: async (query: string, signal?: AbortSignal) => {
      if (query.trim().length < 3) return [];
      return places(
        await request(
          'search/geocode/v6/forward',
          {
            q: query.trim(),
            country: 'gm',
            limit: '5',
            permanent: 'true',
            autocomplete: 'false',
          },
          signal,
        ),
      );
    },
    reverse: async (point: Coordinate, signal?: AbortSignal) => {
      coordinate(point);
      const results = places(
        await request(
          'search/geocode/v6/reverse',
          {
            longitude: String(point[0]),
            latitude: String(point[1]),
            permanent: 'true',
          },
          signal,
        ),
      );
      return results[0] ?? null;
    },
    route: async (
      from: Coordinate,
      to: Coordinate,
      signal?: AbortSignal,
    ): Promise<Coordinate[]> => {
      coordinate(from);
      coordinate(to);
      const data = await request(
        `directions/v5/mapbox/driving/${from.join(',')};${to.join(',')}`,
        { geometries: 'geojson', overview: 'full' },
        signal,
      );
      if (!Array.isArray(data.routes) || !data.routes[0])
        throw new AppError('unavailable');
      const geometry = record(record(data.routes[0]).geometry);
      if (!Array.isArray(geometry.coordinates)) throw new AppError('contract');
      return geometry.coordinates.map(coordinate);
    },
  };
}
