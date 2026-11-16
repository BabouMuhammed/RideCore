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
    backgroundColor: colors.taxi,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.wideBlack,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1,
    color: colors.onTaxi,
  },
});
