import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { Text } from '../../components/ui/Text';
import { colors, radius, space } from '../../theme/tokens';
import type { Landmark } from './landmarks';

// Big, picture-led tiles for popular places: one tap picks the place.
// Two per row so each target is large and the icon does most of the work.
export function PlaceTiles({
  places,
  onPick,
}: {
  places: Landmark[];
  onPick(place: Landmark): void;
}) {
  return (
    <View style={styles.grid}>
      {places.map((place) => (
        <Pressable
          key={place.id}
          accessibilityRole="button"
          accessibilityLabel={`${place.name}, ${place.area}`}
          onPress={() => onPick(place)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <View style={styles.badge}>
            <Icon name={place.icon} size={26} color={colors.brand} />
          </View>
          <Text variant="label" numberOfLines={2}>
            {place.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {place.area}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 120,
    gap: 6,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.neutral },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
    marginBottom: 4,
  },
});
