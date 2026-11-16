import { createElement, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../components/ui/Text';
import { colors } from '../../theme/tokens';
import { osmStyle } from './osmStyle';
import type { MapCanvasProps } from './MapCanvas.types';

// Browser adapter (PC review and the public trip viewer). Native uses
// MapLibre React Native with the same OpenStreetMap style.
export function MapCanvas({ center, pins, route, onSelect }: MapCanvasProps) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const initial = useRef(center);
  useEffect(() => {
    if (!host.current) return;
    let instance: maplibregl.Map | undefined;
    // Wait for the browser to lay out the native-web host before creating WebGL.
    const frame = requestAnimationFrame(() => {
      if (!host.current) return;
      try {
        instance = new maplibregl.Map({
          container: host.current,
          style: osmStyle(),
          center: initial.current,
          zoom: 13,
          attributionControl: false,
        });
        map.current = instance;
        instance.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          'top-right',
        );
        instance.on('load', () => setReady(true));
        instance.on('click', (event) =>
          select.current?.([event.lngLat.lng, event.lngLat.lat]),
        );
        // Individual tile errors are normal on a slow link; only a style
        // failure before the first load means the map is unusable.
        instance.on('error', () => {
          if (!instance?.loaded()) setFailed(true);
        });
      } catch {
        setFailed(true);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      instance?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const markers = pins.map((pin) => {
      const label = document.createElement('span');
      label.textContent = pin.label;
      Object.assign(label.style, {
        backgroundColor: pin.id === 'driver' ? colors.brand : colors.brand,
        color: pin.id === 'driver' ? colors.onBrand : colors.onBrand,
        padding: '6px 9px',
        borderRadius: '12px',
        border: '2px solid white',
        fontFamily: 'Archivo-SemiBold, system-ui, sans-serif',
        fontSize: '13px',
        boxShadow: '0 2px 6px rgba(12,36,22,0.25)',
      });
      return new maplibregl.Marker({ element: label })
        .setLngLat(pin.point)
        .addTo(instance);
    });
    const points = [...pins.map((p) => p.point), ...(route ?? [])];
    if (points.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((p) => bounds.extend(p));
      instance.fitBounds(bounds, {
        padding: { top: 70, bottom: 260, left: 40, right: 40 },
        maxZoom: 15,
      });
    } else instance.easeTo({ center, zoom: 14 });
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route ?? [] },
    };
    const source = instance.getSource('route') as
      maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      instance.addSource('route', { type: 'geojson', data });
      instance.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.brand, 'line-width': 5 },
      });
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [center, pins, route, ready]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.neutral }]}>
      {createElement('div', {
        ref: host,
        style: { position: 'absolute', inset: 0 },
        'aria-label': 'RideCore street map',
      })}
      {failed && (
        <View style={{ padding: 24, paddingTop: 80 }}>
          <Text>The map could not load. Check your connection.</Text>
        </View>
      )}
    </View>
  );
}
