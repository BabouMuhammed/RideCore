import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';
import { colors, type } from '../../theme/tokens';

type Props = TextProps & {
  variant?: keyof typeof type;
  tone?: 'primary' | 'secondary' | 'error' | 'inverse';
};
export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  ...props
}: Props) {
  return (
    <NativeText
      {...props}
      style={[styles.base, type[variant], { color: tones[tone] }, style]}
    />
  );
}
const tones = {
  primary: colors.text,
  secondary: colors.secondary,
  error: colors.error,
  inverse: colors.onBrand,
};
const styles = StyleSheet.create({ base: { flexShrink: 1 } });
