import { DefaultTheme, type Theme } from '@react-navigation/native';
import { colors } from '../theme/tokens';
export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.canvas,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.brand,
  },
};
