import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

// The green band and yellow trim of a Gambian town-trip taxi. Decorative only.
export function TaxiBand({ thin = false }: { thin?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.band, thin && styles.bandThin]} />
      <View style={[styles.trim, thin && styles.trimThin]} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { height: 30, backgroundColor: colors.brand },
  bandThin: { height: 12 },
  trim: { height: 10, backgroundColor: colors.taxi },
  trimThin: { height: 5 },
});
