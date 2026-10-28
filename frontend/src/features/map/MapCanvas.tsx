import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { mapToken } from '../../services/mapbox';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/tokens';
import type { MapCanvasProps } from './MapCanvas.types';

export function MapCanvas({ center, pins, route, onSelect }: MapCanvasProps) {
  const token = mapToken();
  const [failed, setFailed] = useState(false);
  const [configured, setConfigured] = useState<string>();
  const camera = useRef<Mapbox.Camera>(null);
  useEffect(() => {
    let alive = true;
    if (token)
      void Promise.resolve(Mapbox.setAccessToken(token))
        .then(() => {
          if (alive) setConfigured(token);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    return () => {
      alive = false;
    };
  }, [token]);
  useEffect(() => {
    const points = [...pins.map((pin) => pin.point), ...(route ?? [])];
    if (points.length > 1) {
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      camera.current?.fitBounds(
        [Math.max(...xs), Math.max(...ys)],
        [Math.min(...xs), Math.min(...ys)],
        [70, 45, 280, 45],
        500,
      );
    } else
      camera.current?.setCamera({
        centerCoordinate: center,
        zoomLevel: 14,
        animationDuration: 400,
      });
  }, [center, pins, route, configured]);
  if (!token || failed)
    return (
      <View style={styles.notice}>
        <Text>
          {!token
            ? 'Street map is unavailable. Please try again later.'
            : 'The map could not load. Check your connection.'}
        </Text>
        {!!token && (
          <Button
            label="Retry street map"
            variant="secondary"
            onPress={() => setFailed(false)}
          />
        )}
      </View>
    );
  if (configured !== token)
    return (
      <View style={styles.notice}>
        <Text>Loading street map…</Text>
      </View>
    );
  return (
    <Mapbox.MapView
      style={StyleSheet.absoluteFill}
      styleURL={Mapbox.StyleURL.Light}
      onMapLoadingError={() => setFailed(true)}
      onPress={(event) => {
        if (onSelect && event.geometry.type === 'Point')
          onSelect(event.geometry.coordinates as [number, number]);
      }}
    >
      <Mapbox.Camera
        ref={camera}
        defaultSettings={{ centerCoordinate: center, zoomLevel: 14 }}
      />
      {!!route?.length && (
        <Mapbox.ShapeSource
          id="ride-route"
          shape={{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route },
          }}
        >
          <Mapbox.LineLayer
            id="route-line"
            style={{
              lineColor: colors.brand,
              lineWidth: 5,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Mapbox.ShapeSource>
      )}
      {pins.map((pin) => (
        <Mapbox.PointAnnotation
          key={pin.id}
          id={pin.id}
          coordinate={pin.point}
          title={pin.label}
        >
          <View style={styles.pin}>
            <Text tone="inverse" variant="caption">
              {pin.label}
            </Text>
          </View>
        </Mapbox.PointAnnotation>
      ))}
    </Mapbox.MapView>
  );
}
const styles = StyleSheet.create({
  pin: {
    backgroundColor: colors.brand,
    borderColor: colors.surface,
    borderWidth: 2,
    borderRadius: 16,
    padding: 7,
  },
  notice: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral,
    padding: 24,
    paddingTop: 90,
  },
});
