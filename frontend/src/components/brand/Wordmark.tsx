import { StyleSheet, Text as NativeText, View } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

// The RideCore wordmark from Figma: two orange slashes and the name.
export function Wordmark({
  size = 22,
  color = colors.text,
  markColor = colors.brand,
}: {
  size?: number;
  color?: string;
  markColor?: string;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="RideCore"
    >
      <NativeText
        style={[styles.mark, { fontSize: size * 1.05, color: markColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {'//'}
      </NativeText>
      <NativeText style={[styles.name, { fontSize: size, color }]}>
        RideCore
      </NativeText>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mark: { fontFamily: fonts.boldItalic, letterSpacing: -2 },
  name: { fontFamily: fonts.bold, letterSpacing: -0.6 },
});
