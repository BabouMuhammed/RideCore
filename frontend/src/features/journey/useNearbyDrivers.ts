import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Coordinate } from '../../services/journey-api';
import type { MapPin } from '../map/MapCanvas.types';
import { useJourney } from './JourneyProvider';

const none: MapPin[] = [];

/**
 * Real nearby drivers (online, approved, not on a ride) as map markers,
 * refreshed every 15 seconds. Positions come from the backend; none are
 * invented. Returns no markers when discovery fails.
 */
export function useNearbyDrivers(
  around: Coordinate | null,
  enabled = true,
): MapPin[] {
  const { controller } = useJourney();
  const [found, setFound] = useState<{ key: string; pins: MapPin[] }>({
    key: '',
    pins: [],
  });
  // Round so small pans don't refetch; ~100 m precision.
  const key =
    enabled && around
      ? `${around[0].toFixed(3)},${around[1].toFixed(3)}`
      : null;
  useEffect(() => {
    if (!key) return;
    const [lng, lat] = key.split(',').map(Number) as [number, number];
    let alive = true;
    const load = () => {
      if (AppState.currentState !== 'active') return;
      controller
        .run((token, signal) =>
          controller.api.nearbyDrivers(token, [lng, lat], signal),
        )
        .then((drivers) => {
          if (alive)
            setFound({
              key,
              pins: drivers.map((driver) => ({
                id: 'car-' + driver.id,
                point: driver.point,
                label: 'Available driver',
                kind: 'car' as const,
              })),
            });
        })
        .catch(() => {
          if (alive) setFound({ key, pins: [] });
        });
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [controller, key]);
  // Markers for another area (or none) are never shown for this one.
  return found.key === key ? found.pins : none;
}
