import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors, space } from '../../theme/tokens';
import { Text } from './Text';
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View
      accessible
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator color={colors.brand} size="large" accessible={false} />
      <Text tone="secondary">{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },
});
