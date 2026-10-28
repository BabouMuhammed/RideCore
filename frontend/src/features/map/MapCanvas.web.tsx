import { createElement, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../components/ui/Text';
import { mapToken } from '../../services/mapbox';
import { colors } from '../../theme/tokens';
import type { MapCanvasProps } from './MapCanvas.types';

// PC review adapter only. The product uses the native Mapbox SDK on Android/iOS.
export function MapCanvas({ center, pins, route, onSelect }: MapCanvasProps) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<mapboxgl.Map | null>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const token = mapToken();
  const initial = useRef(center);
  useEffect(() => {
    if (!host.current || !token) return;
    let instance: mapboxgl.Map | undefined;
    // Wait for the browser to lay out the native-web host before creating WebGL.
    const frame = requestAnimationFrame(() => {
      if (!host.current) return;
      try {
        instance = new mapboxgl.Map({
          container: host.current,
          accessToken: token,
          style: 'mapbox://styles/mapbox/light-v11',
          center: initial.current,
          zoom: 13,
          attributionControl: false,
          logoPosition: 'top-right',
        });
        map.current = instance;
        instance.addControl(
          new mapboxgl.AttributionControl({ compact: true }),
          'top-right',
        );
        instance.on('load', () => setReady(true));
        instance.on('click', (event) =>
          select.current?.([event.lngLat.lng, event.lngLat.lat]),
        );
        instance.on('error', () => setFailed(true));
      } catch {
        setFailed(true);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      instance?.remove();
      map.current = null;
    };
    // Map instance persists; changes are handled below.
  }, [token]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const markers = pins.map((pin) => {
      const label = document.createElement('span');
      label.textContent = pin.label;
      Object.assign(label.style, {
        backgroundColor: colors.brand,
        color: 'white',
        padding: '7px',
        borderRadius: '12px',
        border: '2px solid white',
      });
      return new mapboxgl.Marker({ element: label })
        .setLngLat(pin.point)
        .addTo(instance);
    });
    const points = [...pins.map((p) => p.point), ...(route ?? [])];
    if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend(p));
      instance.fitBounds(bounds, {
        padding: { top: 65, bottom: 240, left: 40, right: 40 },
        maxZoom: 15,
      });
    } else instance.easeTo({ center, zoom: 14 });
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route ?? [] },
    };
    const source = instance.getSource('route') as
      mapboxgl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      instance.addSource('route', { type: 'geojson', data });
      instance.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: { 'line-color': colors.brand, 'line-width': 5 },
      });
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [center, pins, route, ready]);
  return (
    <View style={StyleSheet.absoluteFill}>
      {createElement('div', {
        ref: host,
        style: { position: 'absolute', inset: 0 },
        'aria-label': 'RideCore street map',
      })}
      {(!token || failed) && (
        <View style={{ padding: 24, paddingTop: 80 }}>
          <Text>
            {!token
              ? 'Street map is unavailable. Please try again later.'
              : 'The map could not load. Check your connection.'}
          </Text>
        </View>
      )}
    </View>
  );
}
