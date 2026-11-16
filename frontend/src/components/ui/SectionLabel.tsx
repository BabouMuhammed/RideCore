import { Text } from './Text';
import { colors, fonts } from '../../theme/tokens';

// Small section heading used for lists ("Recent places", "Saved places").
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="small"
      accessibilityRole="header"
      style={{
        fontFamily: fonts.medium,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}
    >
      {children}
    </Text>
  );
}
