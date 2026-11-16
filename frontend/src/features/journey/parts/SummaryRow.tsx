import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { Text } from '../../../components/ui/Text';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { colors, radius, space } from '../../../theme/tokens';

// A row of the Figma "Booking summary": icon tile, small label, value,
// optional detail line and an optional "Change" action.
export function SummaryRow({
  icon,
  marker,
  label,
  value,
  detail,
  onChange,
  divider = true,
}: {
  icon?: IconName;
  marker?: ReactNode;
  label: string;
  value: string;
  detail?: string;
  onChange?(): void;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.tile}>{marker ?? (icon && <Icon name={icon} size={20} />)}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" tone="secondary">
          {label}
        </Text>
        <Text variant="label" numberOfLines={2}>
          {value}
        </Text>
        {!!detail && (
          <Text variant="small" tone="secondary" numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {onChange && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change ${label.toLowerCase()}`}
          onPress={onChange}
          hitSlop={8}
          style={styles.change}
        >
          <Icon name="pencil" size={14} color={colors.brand} />
          <Text variant="caption" style={{ color: colors.text }}>
            Change
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.tile,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
});
