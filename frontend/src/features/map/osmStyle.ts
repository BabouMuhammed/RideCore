import type { StyleSpecification } from 'maplibre-gl';

// OpenStreetMap raster tiles: free, no key. The public tile server suits
// development and demonstration; point EXPO_PUBLIC_MAP_TILE_URL at another
// {z}/{x}/{y} source for heavier use. Attribution must stay visible.
export const tileUrl = () =>
  process.env.EXPO_PUBLIC_MAP_TILE_URL ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const osmAttribution = '© OpenStreetMap contributors';

export function osmStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [tileUrl()],
        tileSize: 256,
        maxzoom: 19,
        attribution: osmAttribution,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
}
