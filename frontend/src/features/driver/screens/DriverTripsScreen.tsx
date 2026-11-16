import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { TripRow } from '../../activity/TripRow';
import { money } from '../../journey/presentation';
import { safeError } from '../../../services/errors';
import type { Trip } from '../../../services/journey-api';
import { colors, fonts, radius, space } from '../../../theme/tokens';
import { useDriver } from '../DriverProvider';

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DriverTripsScreen() {
  const { controller } = useDriver();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    controller
      .run((token, signal) => controller.api.rides(token, signal))
      .then((rides) => {
        setTrips(rides);
        setError(undefined);
      })
      .catch((failure) => {
        const e = safeError(failure);
        if (e.kind !== 'cancelled') setError(e.message);
      });
  }, [controller]);
  useFocusEffect(load);

  const today = new Date();
  const completedToday = (trips ?? []).filter(
    (trip) =>
      trip.status === 'completed' &&
      sameDay(new Date(String(trip.completedAt ?? trip.requestedAt)), today),
  );
  const earned = completedToday.reduce(
    (sum, trip) => sum + (trip.finalFare ?? trip.estimatedFare),
    0,
  );
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Trips
      </Text>
      <View style={styles.today}>
        <Text tone="inverse">Today</Text>
        <Text style={styles.amount}>{money(earned)}</Text>
        <Text tone="inverse">
          {completedToday.length} completed trip
          {completedToday.length === 1 ? '' : 's'}
        </Text>
      </View>
      {trips === null && !error && <Text>Loading trips…</Text>}
      {trips?.length === 0 && (
        <Text tone="secondary">
          No trips yet. Go online from the Drive tab to receive requests.
        </Text>
      )}
      <View>
        {trips?.map((trip) => (
          <TripRow key={trip._id} trip={trip} onPress={() => undefined} />
        ))}
      </View>
      {error && <Text tone="error">{error}</Text>}
      <Button label="Refresh trips" variant="secondary" onPress={load} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  today: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: space.xl,
    gap: space.xs,
  },
  amount: {
    fontFamily: fonts.medium,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    color: colors.onInk,
  },
});
