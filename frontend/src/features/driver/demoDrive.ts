import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../../services/journey-api';
import type { createMapService } from '../../services/geo';
import { isActiveRide, type DriverController } from './DriverController';

// Demo tool: drives the driver's car along the real road route so riders
// and the shared tracking page see it move, as they would with real GPS.
// On by default; set EXPO_PUBLIC_DEMO_TOOLS=false to hide it.
export const demoToolsEnabled = process.env.EXPO_PUBLIC_DEMO_TOOLS !== 'false';

const TICK_MS = 1000;
// Faster than real traffic so a demo doesn't take the length of a real
// trip, but slow enough to watch: between 20 and 60 ticks per drive.
const MIN_TICKS = 20;
const MAX_TICKS = 60;
const METERS_PER_TICK = 80;

function meters(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Evenly spaced points along a path, ending exactly at its last point. */
export function samplePath(path: Coordinate[], ticks?: number): Coordinate[] {
  if (path.length < 2) return [...path];
  const lengths = path.slice(1).map((point, i) => meters(path[i]!, point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const count =
    ticks ??
    Math.min(
      MAX_TICKS,
      Math.max(MIN_TICKS, Math.ceil(total / METERS_PER_TICK)),
    );
  const out: Coordinate[] = [];
  for (let step = 1; step <= count; step++) {
    let along = (total * step) / count;
    let i = 0;
    while (i < lengths.length - 1 && along > lengths[i]!)
      along -= lengths[i++]!;
    const share = lengths[i] ? Math.min(1, along / lengths[i]!) : 1;
    const [a, b] = [path[i]!, path[i + 1]!];
    out.push([a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share]);
  }
  return out;
}

export function useDemoDrive(
  controller: DriverController,
  maps: ReturnType<typeof createMapService>,
) {
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abort = useRef<AbortController | null>(null);
  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    abort.current?.abort();
    abort.current = null;
    controller.setDemoDriving(false);
    setProgress(null);
  }
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function drive(from: Coordinate, to: Coordinate, onArrive: () => void) {
    stop();
    controller.setDemoDriving(true);
    setProgress(0);
    const signal = (abort.current = new AbortController()).signal;
    let path: Coordinate[] = [from, to];
    try {
      const route = await maps.routeInfo(from, to, signal);
      if (route.points.length >= 2) path = [from, ...route.points, to];
    } catch {
      if (signal.aborted) return;
      // No road route available: drive in a straight line instead.
    }
    const points = samplePath(path);
    let index = 0;
    timer.current = setInterval(() => {
      // The trip ended or was cancelled: stop driving.
      if (!isActiveRide(controller.getSnapshot().ride)) {
        stop();
        return;
      }
      const point = points[index++];
      if (!point) return;
      controller.updateLocation(point, 'demo');
      setProgress(index / points.length);
      if (index >= points.length) {
        stop();
        onArrive();
      }
    }, TICK_MS);
  }
  return { progress, driving: progress !== null, drive, stop };
}
