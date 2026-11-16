import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Icon } from '../../../components/ui/Icon';
import { ListRow } from '../../../components/ui/ListRow';
import { VehicleArt } from '../../../components/brand/VehicleArt';
import { colors, fonts, radius, space } from '../../../theme/tokens';
import { useSession } from '../../session/SessionProvider';
import type { Category, Stop, Trip } from '../../../services/journey-api';

export const rideOptions: {
  category: Category;
  title: string;
  detail: string;
}[] = [
  { category: 'economy', title: 'Ride', detail: 'Everyday rides, made easy' },
  {
    category: 'comfort',
    title: 'Comfort',
    detail: 'A little more room to relax',
  },
  { category: 'xl', title: 'XL', detail: 'More space for your group' },
];

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function RiderHome({
  onPlan,
  history,
}: {
  onPlan(category?: Category, destination?: Stop): void;
  history: Trip[];
}) {
  const { state } = useSession();
  const firstName = state.stage === 'ready' ? state.user.firstName : undefined;
  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>RideCore</Text>
        <Text variant="title" accessibilityRole="header">
          {firstName ? `${greeting()}, ${firstName}` : greeting()}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Where to?"
        onPress={() => onPlan()}
        style={({ pressed }) => [
          styles.search,
          pressed && { backgroundColor: colors.taxiPressed },
        ]}
      >
        <Icon name="search" size={26} color={colors.onTaxi} />
        <Text style={styles.searchLabel}>Where to?</Text>
        <View style={styles.now}>
          <Icon name="activity" size={16} color={colors.onTaxi} />
          <Text variant="caption" style={{ color: colors.onTaxi }}>
            Now
          </Text>
        </View>
      </Pressable>
      {history.length > 0 && (
        <View>
          {history.slice(0, 3).map((trip) => (
            <ListRow
              key={trip._id}
              icon="activity"
              title={trip.destination.address}
              subtitle="Recent destination"
              onPress={() => onPlan(undefined, trip.destination)}
            />
          ))}
        </View>
      )}
      <Text variant="heading">Choose a ride</Text>
      <View style={styles.tiles}>
        {rideOptions.map((option) => (
          <Pressable
            key={option.category}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            onPress={() => onPlan(option.category)}
            style={({ pressed }) => [
              styles.tile,
              pressed && { borderColor: colors.brand },
            ]}
          >
            <VehicleArt width={80} premium={option.category === 'comfort'} />
            <Text variant="label">{option.title}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan your next ride"
        onPress={() => onPlan()}
        style={styles.feature}
      >
        <View style={styles.featureBody}>
          <View style={{ flex: 1, minWidth: 150, gap: 10 }}>
            <Text variant="heading" tone="inverse">
              Know the fare before you go.
            </Text>
            <Text tone="inverse">
              See the price in dalasi for Ride, Comfort or XL, then book.
            </Text>
            <View style={styles.arrow}>
              <Icon name="chevron" color={colors.onTaxi} />
            </View>
          </View>
          <VehicleArt width={140} />
        </View>
        <View style={styles.featureBand} />
      </Pressable>
      <View style={styles.tip}>
        <View style={styles.tipIcon}>
          <Icon name="shield" size={24} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label">Share your journey</Text>
          <Text tone="secondary" variant="caption">
            Keep someone you trust in the loop with a trip link during your
            ride.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { gap: space.xs, marginBottom: space.xs },
  wordmark: {
    fontFamily: fonts.wideBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.brand,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.taxi,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    minHeight: 64,
  },
  searchLabel: {
    flex: 1,
    fontFamily: fonts.wideBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.onTaxi,
  },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(12, 36, 22, 0.3)',
    paddingLeft: 12,
  },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 16,
  },
  feature: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginVertical: 8,
  },
  featureBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: 20,
  },
  featureBand: { height: 10, backgroundColor: colors.taxi },
  arrow: {
    backgroundColor: colors.taxi,
    borderRadius: radius.pill,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  tipIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
