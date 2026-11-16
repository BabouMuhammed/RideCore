import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, size, space } from '../../theme/tokens';
import { IconButton } from '../ui/IconButton';
import { Text } from '../ui/Text';
import { TaxiBand } from '../brand/TaxiBand';

// Yellow page header with the taxi band, used where the welcome screen's
// identity should carry through (sign-in, registration, verification).
export function BrandHeader({
  title,
  subtitle,
  onBack,
  backDisabled = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <View style={styles.inner}>
          {onBack && (
            <IconButton
              icon="back"
              label="Go back"
              onPress={onBack}
              disabled={backDisabled}
              tone="onTaxi"
            />
          )}
          <Text variant="title" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle && <Text style={{ color: colors.onTaxi }}>{subtitle}</Text>}
        </View>
      </View>
      <TaxiBand thin />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.taxi,
    paddingHorizontal: space.lg + 4,
    paddingBottom: space.xl,
  },
  inner: {
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    gap: space.md,
  },
  title: { color: colors.onTaxi, marginTop: space.sm },
});
