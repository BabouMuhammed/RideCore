import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, size } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';

/**
 * default: the Figma "Back button" — 48px square, 12px corners, hairline
 * border, white so it also reads on top of the map.
 * plain: a borderless icon action inside another control (e.g. show password).
 */
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'plain';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={tone === 'plain' ? 4 : 0}
      style={({ pressed }) => [
        tone === 'plain' ? styles.plain : styles.button,
        pressed && { backgroundColor: colors.neutral },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    width: size.back,
    height: size.back,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
