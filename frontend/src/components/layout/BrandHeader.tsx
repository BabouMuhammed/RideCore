import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, size, space } from '../../theme/tokens';
import { IconButton } from '../ui/IconButton';
import { Headline } from '../ui/Headline';
import { Text } from '../ui/Text';

// Page header from the Figma auth screens: back button, then a large
// headline with *emphasised* words, then supporting copy.
export function BrandHeader({
  title,
  subtitle,
  onBack,
  backDisabled = false,
}: {
  /** Use asterisks for bold-italic emphasis: "What's your *number*?" */
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.inner}>
        {onBack && (
          <IconButton
            icon="back"
            label="Go back"
            onPress={onBack}
            disabled={backDisabled}
          />
        )}
        <View style={[styles.copy, !onBack && { marginTop: 0 }]}>
          <Headline text={title} />
          {subtitle && <Text tone="secondary">{subtitle}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.canvas,
    paddingHorizontal: space.xl,
  },
  inner: {
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
  },
  copy: { gap: space.lg, marginTop: space.xxxl },
});
