import { Platform } from 'react-native';
import { coordinate, type Coordinate, type Stop } from './journey-api';
import { record } from './api';
import { AppError } from './errors';

// Free, open map services (no account or key), as committed in the project
// proposal: Nominatim for addresses and OSRM for road geometry. Each can be
// pointed at a self-hosted server through its EXPO_PUBLIC_ variable.
// Fares never come from here: the backend stays authoritative.
export const geoConfig = {
  geocoder: () =>
    process.env.EXPO_PUBLIC_GEOCODER_URL ||
    'https://nominatim.openstreetmap.org',
  router: () =>
    process.env.EXPO_PUBLIC_ROUTER_URL || 'https://router.project-osrm.org',
};

export const initialCenter: Coordinate = [-16.579, 13.454]; // Region, never claimed as rider GPS.

export function makeStop(address: string, coordinates: Coordinate): Stop {
  if (!address.trim() || address.trim().length > 120)
    throw new AppError('validation');
  return {
    address: address.trim(),
    location: { type: 'Point', coordinates: coordinate(coordinates) },
  };
}

// OpenStreetMap fields are often missing or empty; treat those as absent.
const str = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

// Nominatim's display_name lists every administrative level ("Kairaba Avenue,
// Serrekunda, Kanifing, The Gambia"). Riders and drivers need the first few.
export function shortAddress(place: Record<string, unknown>): string {
  const address = place.address ? record(place.address) : {};
  const pick = (...keys: string[]) =>
    keys.map((key) => str(address[key])).find(Boolean) ?? '';
  const parts = [
    str(place.name),
    [pick('house_number'), pick('road', 'pedestrian', 'footway')]
      .filter(Boolean)
      .join(' '),
    pick('suburb', 'neighbourhood', 'quarter', 'village', 'hamlet'),
    pick('city', 'town', 'city_district', 'county', 'state'),
  ].filter(Boolean);
  const unique = parts.filter(
    (part, index) =>
      parts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) ===
      index,
  );
  const fallback = str(place.display_name)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const chosen = (unique.length ? unique : fallback).slice(0, 3);
  let label = chosen.join(', ');
  while (label.length > 120 && chosen.length > 1) {
    chosen.pop();
    label = chosen.join(', ');
  }
  return label.slice(0, 120);
}

export function createMapService(
  fetcher: typeof fetch = fetch,
  config = { geocoder: geoConfig.geocoder(), router: geoConfig.router() },
) {
  async function request(url: string, signal?: AbortSignal) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal?.addEventListener('abort', cancel);
    if (signal?.aborted) abort.abort();
    const timer = setTimeout(cancel, 15000);
    try {
      const response = await fetcher(url, {
        signal: abort.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
          // Nominatim's usage policy asks apps to identify themselves.
          // Browsers forbid setting User-Agent, so only native sends it.
          ...(Platform.OS === 'web'
            ? {}
            : { 'User-Agent': 'RideCore/0.1 (UTG final year project)' }),
        },
      });
      if (!response.ok)
        throw new AppError(response.status === 429 ? 'rate' : 'server');
      return (await response.json()) as unknown;
    } catch (error) {
      if (signal?.aborted) throw new AppError('cancelled');
      throw error instanceof AppError ? error : new AppError('network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  function base(url: string) {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(trimmed)) throw new AppError('configuration');
    return trimmed;
  }
  function toStop(value: unknown): Stop {
    const place = record(value);
    const lng = Number(place.lon),
      lat = Number(place.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat))
      throw new AppError('contract');
    const label = shortAddress(place);
    if (!label) throw new AppError('contract');
    return makeStop(label, coordinate([lng, lat]));
  }
  return {
    search: async (query: string, signal?: AbortSignal) => {
      if (query.trim().length < 3) return [];
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'jsonv2',
        addressdetails: '1',
        countrycodes: 'gm',
        limit: '5',
      });
      const data = await request(
        `${base(config.geocoder)}/search?${params}`,
        signal,
      );
      if (!Array.isArray(data)) throw new AppError('contract');
      return data.map(toStop);
    },
    reverse: async (point: Coordinate, signal?: AbortSignal) => {
      coordinate(point);
      const params = new URLSearchParams({
        lat: String(point[1]),
        lon: String(point[0]),
        format: 'jsonv2',
        addressdetails: '1',
        zoom: '17',
      });
      const data = await request(
        `${base(config.geocoder)}/reverse?${params}`,
        signal,
      );
      // Nominatim answers an unmapped point with { error: "Unable to geocode" }.
      if (!data || typeof data !== 'object' || 'error' in data) return null;
      return toStop(data);
    },
    route: async (
      from: Coordinate,
      to: Coordinate,
      signal?: AbortSignal,
    ): Promise<Coordinate[]> => {
      coordinate(from);
      coordinate(to);
      const data = record(
        await request(
          `${base(config.router)}/route/v1/driving/${from.join(',')};${to.join(',')}?overview=full&geometries=geojson`,
          signal,
        ),
      );
      if (data.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes[0])
        throw new AppError('unavailable');
      const geometry = record(record(data.routes[0]).geometry);
      if (!Array.isArray(geometry.coordinates)) throw new AppError('contract');
      return geometry.coordinates.map(coordinate);
    },
  };
}
