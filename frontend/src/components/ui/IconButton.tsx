import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, size } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
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
  tone?: 'default' | 'onTaxi';
}) {
  const rest = tone === 'onTaxi' ? colors.surface : colors.neutral;
  const down = tone === 'onTaxi' ? colors.taxiPressed : colors.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? down : rest },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    width: size.touch,
    minWidth: size.touch,
    minHeight: size.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
