import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, size, space } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      {icon && (
        <View style={styles.icon}>
          <Icon name={icon} size={20} />
        </View>
      )}
      <View style={styles.copy}>
        <Text variant="label">{title}</Text>
        {subtitle && (
          <Text tone="secondary" variant="caption">
            {subtitle}
          </Text>
        )}
      </View>
      {onPress && <Icon name="chevron" size={16} color={colors.secondary} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.neutral },
        disabled && { opacity: 0.5 },
      ]}
    >
      {content}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1, gap: space.xs },
  icon: {
    width: size.tile,
    height: size.tile,
    borderRadius: radius.tile,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
