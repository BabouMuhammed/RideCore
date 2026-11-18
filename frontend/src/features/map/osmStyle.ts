import type { StyleSpecification } from 'maplibre-gl';

// Map look and tiles. By default this is OpenFreeMap's "Positron" style:
// a clean, light basemap built from OpenStreetMap data, free with no key,
// registration or request limits. The style carries its own attribution.
//
// The public tile.openstreetmap.org server is not used: its usage policy
// forbids apps from relying on it, and it answers such apps with
// "Access blocked" tiles.
//
// EXPO_PUBLIC_MAP_STYLE_URL swaps in another MapLibre style URL.
// EXPO_PUBLIC_MAP_TILE_URL (a raster {z}/{x}/{y} source) still works for
// a self-hosted or paid tile server.
export const defaultStyleUrl = 'https://tiles.openfreemap.org/styles/positron';

export const osmAttribution =
  '© OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors';

export function osmStyle(): string | StyleSpecification {
  const raster = process.env.EXPO_PUBLIC_MAP_TILE_URL;
  if (raster)
    return {
      version: 8,
      sources: {
        tiles: {
          type: 'raster',
          tiles: [raster],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }],
    };
  return process.env.EXPO_PUBLIC_MAP_STYLE_URL || defaultStyleUrl;
}
