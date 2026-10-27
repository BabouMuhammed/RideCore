import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  brand: '#125C46',
  brandPressed: '#0B4433',
  brandSoft: '#E7F1EB',
  canvas: '#FAFBF8',
  surface: '#FFFFFF',
  neutral: '#F0F2EF',
  text: '#18201C',
  secondary: '#59645D',
  border: '#D5DDD7',
  error: '#B42332',
  errorSoft: '#FCECEE',
  onBrand: '#FFFFFF',
  disabled: '#DFE5E0',
  disabledText: '#59645D',
  scrim: 'rgba(13, 24, 18, 0.45)',
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
export const radius = { sm: 8, md: 12, lg: 16, sheet: 28, pill: 999 } as const;
export const size = {
  touch: 48,
  input: 56,
  icon: 24,
  iconSmall: 20,
  iconLarge: 32,
  contentMax: 560,
} as const;
export const type = {
  display: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
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
