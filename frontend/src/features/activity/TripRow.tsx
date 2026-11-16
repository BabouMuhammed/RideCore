import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Icon } from '../../components/ui/Icon';
import { money } from '../journey/presentation';
import { colors, fonts, radius, size, space } from '../../theme/tokens';
import type { Trip } from '../../services/journey-api';

const outcome: Record<Trip['status'], { label: string; tone: 'done' | 'cancelled' | 'live' }> = {
  requested: { label: 'Requested', tone: 'live' },
  accepted: { label: 'Driver matched', tone: 'live' },
  driver_arriving: { label: 'Driver on the way', tone: 'live' },
  driver_arrived: { label: 'Driver arrived', tone: 'live' },
  in_progress: { label: 'On trip', tone: 'live' },
  completed: { label: 'Completed', tone: 'done' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
};

export function tripDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TripRow({ trip, onPress }: { trip: Trip; onPress(): void }) {
  const state = outcome[trip.status];
  const fare = money(trip.finalFare ?? trip.estimatedFare, trip.currency);
  const date = tripDate(trip.requestedAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.destination.address}, ${state.label}, ${fare}, ${date}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.neutral }]}
    >
      <View style={styles.icon}>
        <Icon name="car" size={20} />
      </View>
      <View style={styles.copy}>
        <Text variant="label" numberOfLines={2}>
          {trip.destination.address}
        </Text>
        <View style={styles.meta}>
          <View
            style={[
              styles.badge,
              state.tone === 'done' && { backgroundColor: colors.successSoft },
              state.tone === 'cancelled' && { backgroundColor: colors.errorSoft },
              state.tone === 'live' && { backgroundColor: colors.brand },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                state.tone === 'done' && { color: colors.success },
                state.tone === 'cancelled' && { color: colors.error },
              ]}
            >
              {state.label}
            </Text>
          </View>
          <Text variant="caption" tone="secondary">
            {date}
          </Text>
        </View>
      </View>
      <Text style={[styles.fare, trip.status === 'cancelled' && { color: colors.secondary }]}>
        {fare}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.onBrand },
  fare: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.text },
});
