import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { Icon } from '../../../components/ui/Icon';
import { colors, radius, space } from '../../../theme/tokens';

// Figma "Vehicle option": white card; selected = orange tint, 1.5px orange
// border and an orange dot.
export function VehicleOption({
  title,
  description,
  seats,
  fare,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  seats: string;
  fare: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${fare}, ${description}`}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={[styles.card, selected ? styles.selected : styles.default]}
    >
      <View style={[styles.vehicle, !selected && { backgroundColor: colors.neutral }]}>
        <Icon name="car" size={26} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <Text variant="label" style={{ flex: 1 }}>
            {title}
          </Text>
          <Text variant="label">{fare}</Text>
        </View>
        <Text variant="small" tone="secondary">
          {description}
        </Text>
        <Text variant="small" tone="secondary">
          {seats}
        </Text>
      </View>
      {selected && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 96,
    padding: space.md,
    borderRadius: radius.md,
  },
  default: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.brandSoft, borderWidth: 1.5, borderColor: colors.brand },
  vehicle: {
    width: 40,
    height: 40,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginLeft: 2 },
});
