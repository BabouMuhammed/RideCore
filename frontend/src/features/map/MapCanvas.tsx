import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/tokens';
import { osmStyle, osmAttribution } from './osmStyle';
import type { MapCanvasProps } from './MapCanvas.types';

// Native map: MapLibre with OpenStreetMap tiles. No account, key or paid SDK.
export function MapCanvas({ center, pins, route, onSelect }: MapCanvasProps) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const camera = useRef<CameraRef>(null);
  useEffect(() => {
    const points = [...pins.map((pin) => pin.point), ...(route ?? [])];
    if (points.length > 1) {
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      camera.current?.fitBounds(
        [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        {
          padding: { top: 70, right: 45, bottom: 280, left: 45 },
          duration: 500,
        },
      );
    } else camera.current?.easeTo({ center, zoom: 14, duration: 400 });
  }, [center, pins, route]);
  if (failed)
    return (
      <View style={styles.notice}>
        <Text>The map could not load. Check your connection.</Text>
        <Button
          label="Retry street map"
          variant="secondary"
          onPress={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        />
      </View>
    );
  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        key={attempt}
        style={StyleSheet.absoluteFill}
        mapStyle={osmStyle()}
        logo={false}
        attribution={false}
        compass={false}
        onDidFailLoadingMap={() => setFailed(true)}
        onPress={(event) => {
          const lngLat = event.nativeEvent?.lngLat;
          if (onSelect && lngLat) onSelect([lngLat[0], lngLat[1]]);
        }}
      >
        <Camera
          ref={camera}
          initialViewState={{ center, zoom: 14 }}
        />
        {!!route?.length && (
          <GeoJSONSource
            id="ride-route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route },
            }}
          >
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.brand, 'line-width': 5 }}
            />
          </GeoJSONSource>
        )}
        {pins.map((pin) => (
          <Marker key={pin.id} id={pin.id} lngLat={pin.point}>
            <View
              style={[styles.pin, pin.id === 'driver' && styles.driverPin]}
              accessible
              accessibilityLabel={pin.label}
            >
              <Text
                variant="caption"
                style={{
                  color: pin.id === 'driver' ? colors.onBrand : colors.onBrand,
                }}
              >
                {pin.label}
              </Text>
            </View>
          </Marker>
        ))}
      </Map>
      {/* OpenStreetMap's licence requires visible attribution. */}
      <View
        style={[styles.attribution, { top: insets.top + 64 }]}
        pointerEvents="none"
      >
        <Text style={styles.attributionText}>{osmAttribution}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  pin: {
    backgroundColor: colors.brand,
    borderColor: colors.surface,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  driverPin: { backgroundColor: colors.brand },
  notice: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral,
    padding: 24,
    paddingTop: 90,
    gap: 16,
  },
  attribution: {
    position: 'absolute',
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  attributionText: { fontSize: 11, lineHeight: 14, color: colors.text },
});
