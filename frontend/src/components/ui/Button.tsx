import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { colors, radius, size, space } from '../../theme/tokens';
import { Text } from './Text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
};
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: Props) {
  const unavailable = disabled || loading;
  const foreground = unavailable
    ? colors.disabledText
    : variant === 'secondary'
      ? colors.text
      : colors.onBrand;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!unavailable, busy: loading }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: unavailable
            ? colors.disabled
            : variant === 'secondary'
              ? colors.neutral
              : variant === 'destructive'
                ? colors.error
                : pressed
                  ? colors.brandPressed
                  : colors.brand,
        },
        pressed && !unavailable && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator color={foreground} accessibilityLabel="Loading" />
        )}
        <Text
          variant="label"
          style={{ color: foreground, textAlign: 'center' }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: size.touch,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  pressed: { opacity: 0.88 },
});
