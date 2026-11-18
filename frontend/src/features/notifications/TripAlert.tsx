import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Text } from '../../components/ui/Text';
import { colors, radius, space } from '../../theme/tokens';
import type { Trip } from '../../services/journey-api';
import { PlateBadge } from '../journey/PlateBadge';
import { alertRider } from './alertSound';

type Alert = { kind: 'accepted' | 'arrived'; title: string; body: string };

/** The in-app moment for "driver found" and "your driver has arrived". */
export function tripAlert(
  trip: Pick<Trip, 'status' | 'driverDetails' | 'vehicle'>,
): Alert | null {
  const name = trip.driverDetails?.firstName ?? 'Your driver';
  const car = trip.vehicle
    ? `${trip.vehicle.color} ${trip.vehicle.make} ${trip.vehicle.model}`
    : 'your driver’s car';
  if (trip.status === 'accepted')
    return {
      kind: 'accepted',
      title: `${name} is on the way`,
      body: `Look out for the ${car}.`,
    };
  if (trip.status === 'driver_arrived')
    return {
      kind: 'arrived',
      title: 'Your driver has arrived',
      body: `Meet ${name} in the ${car} at your pickup.`,
    };
  return null;
}

// Shows once per status change, with a chime (and vibration on phones that
// support it). Accepted fades away by itself; arrived stays until dismissed.
export function TripAlert({
  trip,
  top = 76,
}: {
  trip: Trip | null;
  top?: number;
}) {
  const key = trip ? `${trip._id}:${trip.status}` : null;
  // The status when the screen first had a ride: an old moment isn't
  // replayed on opening the app (React's "adjust state during render").
  const [baseline, setBaseline] = useState<string | null | undefined>(
    undefined,
  );
  if (trip && baseline === undefined) setBaseline(key);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [expired, setExpired] = useState<string | null>(null);
  const alert =
    trip &&
    baseline !== undefined &&
    key !== baseline &&
    key !== dismissed &&
    key !== expired
      ? tripAlert(trip)
      : null;
  const shownKey = alert ? key : null;
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!shownKey || !alert) return;
    alertRider(alert.kind === 'arrived' ? 'strong' : 'soft');
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (alert.kind === 'accepted') {
      const timer = setTimeout(() => setExpired(shownKey), 6000);
      return () => clearTimeout(timer);
    }
    // Only a new moment should replay the sound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);
  if (!alert || !trip) return null;
  const arrived = alert.kind === 'arrived';
  return (
    <Animated.View
      style={[styles.wrap, arrived && styles.strong, { opacity, top }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={[styles.icon, arrived && styles.iconStrong]}>
        <Icon
          name={arrived ? 'pin' : 'car'}
          size={22}
          color={arrived ? colors.onBrand : colors.brand}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" tone={arrived ? 'inverse' : 'primary'}>
          {alert.title}
        </Text>
        <Text variant="caption" tone={arrived ? 'inverse' : 'secondary'}>
          {alert.body}
        </Text>
        {trip.vehicle && (
          <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <PlateBadge plate={trip.vehicle.plateNumber} />
          </View>
        )}
        {arrived && (
          <View style={{ marginTop: space.sm }}>
            <Button
              label="I’m on my way"
              variant="secondary"
              onPress={() => setDismissed(key)}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    top: 76,
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 20,
  },
  strong: { backgroundColor: colors.ink, borderColor: colors.ink },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  iconStrong: { backgroundColor: colors.brand },
});
