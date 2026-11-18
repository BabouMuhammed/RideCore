import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { money } from '../../journey/presentation';
import type { RideRequest } from '../../../services/driver-api';
import type { Coordinate } from '../../../services/journey-api';
import { colors, fonts, radius, space } from '../../../theme/tokens';

/** Straight-line distance in km, for "how far is the pickup" only. */
export function kmBetween([lng1, lat1]: Coordinate, [lng2, lat2]: Coordinate) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad,
    dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const km = (value: number) =>
  value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(1)} km`;

export function RequestCard({
  index,
  request,
  from,
  busy,
  onAccept,
}: {
  index: number;
  request: RideRequest;
  from: Coordinate | null;
  busy: boolean;
  onAccept(): void;
}) {
  const away = from
    ? kmBetween(from, request.pickup.location.coordinates)
    : null;
  // Riders wait about a minute; show the driver how long is left.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!request.requestExpiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [request.requestExpiresAt]);
  const left = request.requestExpiresAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(request.requestExpiresAt) - now) / 1000),
      )
    : null;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {/* Matches the numbered pickup pin on the map. */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={2}>
            {request.pickup.address}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            to {request.destination.address}
          </Text>
        </View>
        <Text style={styles.fare}>
          {money(request.estimatedFare, request.currency)}
        </Text>
      </View>
      <Text variant="caption" tone="secondary">
        {[
          away != null ? `Pickup ${km(away)} away` : null,
          `Trip ${km(request.distance)}`,
          left != null
            ? left > 0
              ? `Expires in ${left}s`
              : 'Expiring…'
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Button
        label="Accept ride"

        disabled={busy}
        onPress={onAccept}
        accessibilityLabel={`Accept ride from ${request.pickup.address}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.onBrand,
  },
  fare: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
});
