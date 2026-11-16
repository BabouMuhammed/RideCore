import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { Icon } from '../../../components/ui/Icon';
import type { Stop } from '../../../services/journey-api';
import { colors, space } from '../../../theme/tokens';

/** Splits "Westfield Junction, Kairaba Avenue, Serrekunda" into name + rest. */
export function splitAddress(address: string) {
  const [name, ...rest] = address.split(',');
  return { name: name!.trim(), detail: rest.join(',').trim() };
}

function Row({
  kind,
  stop,
  placeholder,
  onPress,
}: {
  kind: 'pickup' | 'destination';
  stop: Stop | null;
  placeholder: string;
  onPress?(): void;
}) {
  const parts = stop ? splitAddress(stop.address) : null;
  const content = (
    <>
      <View style={styles.marker}>
        {kind === 'pickup' ? (
          <View style={styles.ring} />
        ) : (
          <Icon name="pin" size={22} color={colors.brand} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" tone={parts ? 'primary' : 'secondary'} numberOfLines={2}>
          {parts?.name ?? placeholder}
        </Text>
        {!!parts?.detail && (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {parts.detail}
          </Text>
        )}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${kind === 'pickup' ? 'Pickup' : 'Destination'}: ${stop?.address ?? placeholder}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  );
}

// Figma "Trip addresses": pickup ring, destination pin, name and address.
export function TripAddresses({
  pickup,
  destination,
  onPickup,
  onDestination,
}: {
  pickup: Stop | null;
  destination: Stop | null;
  onPickup?(): void;
  onDestination?(): void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Row kind="pickup" stop={pickup} placeholder="Choose a pickup point" onPress={onPickup} />
      <Row kind="destination" stop={destination} placeholder="Choose a destination" onPress={onDestination} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  marker: { width: 24, alignItems: 'center' },
  ring: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.text,
  },
});
