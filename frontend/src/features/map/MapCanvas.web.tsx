import { createElement, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../components/ui/Text';
import { colors } from '../../theme/tokens';
import { osmStyle } from './osmStyle';
import { cameraKey, type MapCanvasProps } from './MapCanvas.types';

// Browser adapter (PC review and the public trip viewer). Native uses
// MapLibre React Native with the same OpenStreetMap style.
const carSvg =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191919" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

export function MapCanvas(props: MapCanvasProps) {
  const { center, pins, route, onSelect, onCenterChange, bottomInset = 0 } =
    props;
  const host = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  const moved = useRef(onCenterChange);
  const lastCamera = useRef('');
  useEffect(() => {
    select.current = onSelect;
    moved.current = onCenterChange;
  }, [onSelect, onCenterChange]);
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
        // Only moves made by the person (drag, pinch), not our own camera.
        instance.on('moveend', (event) => {
          if (!('originalEvent' in event) || !event.originalEvent || !instance)
            return;
          const point = instance.getCenter();
          moved.current?.([point.lng, point.lat]);
        });
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
      if (pin.kind === 'car') {
        const car = document.createElement('div');
        car.innerHTML = carSvg;
        car.setAttribute('role', 'img');
        car.setAttribute('aria-label', pin.label);
        Object.assign(car.style, {
          width: '30px',
          height: '30px',
          borderRadius: '15px',
          backgroundColor: 'white',
          border: '1.5px solid #191919',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(25,25,25,0.25)',
        });
        return new maplibregl.Marker({ element: car })
          .setLngLat(pin.point)
          .addTo(instance);
      }
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
    const key = cameraKey({ center, pins, route });
    if (key !== lastCamera.current) {
      lastCamera.current = key;
      const points = [
        ...pins.filter((p) => p.kind !== 'car').map((p) => p.point),
        ...(route ?? []),
      ];
      if (points.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((p) => bounds.extend(p));
        instance.fitBounds(bounds, {
          padding: { top: 70, bottom: 260, left: 40, right: 40 },
          maxZoom: 15,
        });
      } else instance.easeTo({ center, zoom: 14 });
    }
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
  useEffect(() => {
    if (!ready) return;
    map.current?.easeTo({
      padding: { top: 0, left: 0, right: 0, bottom: bottomInset },
      duration: 200,
    });
  }, [bottomInset, ready]);
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
