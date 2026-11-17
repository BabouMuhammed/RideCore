import type { Coordinate } from '../../services/journey-api';
export type MapPin = {
  id: string;
  point: Coordinate;
  label: string;
  /** 'car' draws a small vehicle marker (nearby drivers) instead of a label. */
  kind?: 'car';
};
export type MapCanvasProps = {
  center: Coordinate;
  pins: MapPin[];
  route?: Coordinate[];
  onSelect?: (point: Coordinate) => void;
  /** Called with the map's centre after the person pans or zooms it. */
  onCenterChange?: (point: Coordinate) => void;
  /**
   * Height in px covered by a sheet at the bottom. The map treats the area
   * above it as its viewport, so "centre" is the middle of what is visible.
   */
  bottomInset?: number;
};

/**
 * The camera should only move when the trip itself changes (centre, labelled
 * pins or route), not when nearby-driver markers refresh, or it would keep
 * snapping back while someone is panning the map.
 */
export function cameraKey({ center, pins, route }: MapCanvasProps) {
  return JSON.stringify([
    center,
    pins.filter((pin) => pin.kind !== 'car').map((pin) => pin.point),
    route?.length ?? 0,
  ]);
}
