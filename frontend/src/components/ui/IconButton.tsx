import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, size } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.border : colors.neutral },
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
