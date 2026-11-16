import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { colors, radius, size, space } from '../../theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /**
   * primary: the Figma "Primary button" — near-black, label left, orange
   * action circle right. secondary: quiet outlined action. destructive:
   * irreversible actions such as confirming a cancellation.
   */
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
  if (variant === 'primary')
    return (
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!unavailable, busy: loading }}
        disabled={unavailable}
        style={({ pressed }) => [
          styles.primary,
          {
            backgroundColor:
              disabled && !loading
                ? colors.disabled
                : pressed
                  ? colors.inkPressed
                  : colors.ink,
          },
        ]}
      >
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            flex: 1,
            color: disabled && !loading ? colors.disabledText : colors.onInk,
          }}
        >
          {label}
        </Text>
        <View
          style={[
            styles.action,
            disabled && !loading && { backgroundColor: colors.border },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrand} accessibilityLabel="Loading" />
          ) : (
            <Icon
              name="arrowUpRight"
              size={20}
              color={disabled ? colors.disabledText : colors.onBrand}
            />
          )}
        </View>
      </Pressable>
    );
  const foreground = unavailable
    ? colors.disabledText
    : variant === 'destructive'
      ? colors.inverse
      : colors.text;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!unavailable, busy: loading }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.base,
        variant === 'destructive'
          ? {
              backgroundColor: unavailable
                ? colors.disabled
                : pressed
                  ? '#931C29'
                  : colors.error,
              borderColor: 'transparent',
            }
          : {
              backgroundColor: pressed ? colors.neutral : colors.surface,
              borderColor: colors.border,
            },
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator color={foreground} accessibilityLabel="Loading" />
        )}
        <Text variant="label" style={{ color: foreground, textAlign: 'center' }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  primary: {
    minHeight: size.touch,
    borderRadius: radius.md,
    paddingLeft: 20,
    paddingRight: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  base: {
    minHeight: size.touch,
    borderRadius: radius.md,
    borderWidth: 1,
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
});
