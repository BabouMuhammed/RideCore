import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { colors, fonts } from '../../theme/tokens';

// Styled like a number plate so riders can match it to the car at a glance.
export function PlateBadge({ plate }: { plate: string }) {
  return (
    <View style={styles.plate} accessible accessibilityLabel={`Plate number ${plate}`}>
      <Text style={styles.text}>{plate.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 1,
    color: colors.text,
  },
});
