import type { Coordinate } from '../../services/journey-api';
export type MapPin = { id: string; point: Coordinate; label: string };
export type MapCanvasProps = {
  center: Coordinate;
  pins: MapPin[];
  route?: Coordinate[];
  onSelect?: (point: Coordinate) => void;
};
