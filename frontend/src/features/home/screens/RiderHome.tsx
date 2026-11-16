import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Icon } from '../../../components/ui/Icon';
import { ListRow } from '../../../components/ui/ListRow';
import { VehicleArt } from '../../../components/brand/VehicleArt';
import { colors, radius } from '../../../theme/tokens';
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

export function RiderHome({
  onPlan,
  history,
}: {
  onPlan(category?: Category, destination?: Stop): void;
  history: Trip[];
}) {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="display" style={styles.wordmark}>
        RideCore
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Where to?"
        onPress={() => onPlan()}
        style={styles.search}
      >
        <Icon name="search" size={26} />
        <Text variant="heading" style={{ flex: 1 }}>
          Where to?
        </Text>
        <View style={styles.now}>
          <Icon name="activity" size={16} />
          <Text variant="caption">Now</Text>
        </View>
      </Pressable>
      {history.slice(0, 2).map((trip) => (
        <ListRow
          key={trip._id}
          icon="activity"
          title={trip.destination.address}
          subtitle="Recent destination"
          onPress={() => onPlan(undefined, trip.destination)}
        />
      ))}
      <Text variant="heading">Suggestions</Text>
      <View style={styles.tiles}>
        {rideOptions.map((option) => (
          <Pressable
            key={option.category}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            onPress={() => onPlan(option.category)}
            style={styles.tile}
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
        <View style={{ flex: 1, minWidth: 150, gap: 10 }}>
          <Text variant="heading">Go anywhere.{'\n'}Get there your way.</Text>
          <Text>Find the right ride for you</Text>
          <View style={styles.arrow}>
            <Icon name="chevron" />
          </View>
        </View>
        <VehicleArt width={150} />
      </Pressable>
      <Text variant="heading">A ride for every day</Text>
      <View style={styles.tip}>
        <Icon name="shield" size={28} />
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
  wordmark: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '500',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.neutral,
    borderRadius: radius.pill,
    padding: 16,
    minHeight: 64,
  },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#CBCBCB',
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
    paddingVertical: 16,
  },
  feature: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#D5E5E3',
    borderRadius: radius.lg,
    padding: 20,
    overflow: 'hidden',
    marginVertical: 8,
  },
  arrow: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
});
