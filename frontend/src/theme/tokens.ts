import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  brand: '#000000',
  brandPressed: '#333333',
  brandSoft: '#EEEEEE',
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  neutral: '#F3F3F3',
  text: '#000000',
  secondary: '#6B6B6B',
  border: '#E2E2E2',
  error: '#B42332',
  errorSoft: '#FCECEE',
  onBrand: '#FFFFFF',
  disabled: '#E8E8E8',
  disabledText: '#6B6B6B',
  scrim: 'rgba(0, 0, 0, 0.45)',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  hero: 64,
} as const;
export const radius = { sm: 8, md: 8, lg: 16, sheet: 24, pill: 999 } as const;
export const size = {
  touch: 52,
  input: 56,
  icon: 24,
  iconSmall: 20,
  iconLarge: 32,
  contentMax: 560,
} as const;
export const type = {
  display: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
} satisfies Record<string, TextStyle>;
export const elevation = {
  floating: {
    shadowColor: '#18201C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  sheet: {
    shadowColor: '#18201C',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
