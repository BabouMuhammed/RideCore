import type { TextStyle, ViewStyle } from 'react-native';

// "Town Trip" — RideCore's visual identity, drawn from the yellow town-trip
// taxis with the green band seen across the Greater Banjul Area.
export const colors = {
  brand: '#0B6B3A', // band green: primary actions
  brandPressed: '#08552E',
  brandSoft: '#E3F0E8',
  taxi: '#FFC20E', // taxi yellow: the one bold highlight per screen
  taxiPressed: '#EBB000',
  onTaxi: '#0C2416',
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  neutral: '#F1F3EE',
  text: '#0C2416', // deep green ink
  secondary: '#4A5A50',
  border: '#DCE1D8',
  error: '#B42332',
  errorSoft: '#FCECEE',
  onBrand: '#FFFFFF',
  disabled: '#E6E9E3',
  disabledText: '#5E6B62',
  scrim: 'rgba(12, 36, 22, 0.5)',
} as const;

// Static instances of Archivo (SIL OFL 1.1), bundled in assets/fonts.
// Android needs one family name per weight, so weights live in the family.
export const fonts = {
  regular: 'Archivo-Regular',
  medium: 'Archivo-Medium',
  semibold: 'Archivo-SemiBold',
  bold: 'Archivo-Bold',
  wideBold: 'ArchivoExpanded-ExtraBold',
  wideBlack: 'ArchivoExpanded-Black',
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
export const radius = { sm: 8, md: 14, lg: 18, sheet: 24, pill: 999 } as const;
export const size = {
  touch: 54,
  input: 56,
  icon: 24,
  iconSmall: 20,
  iconLarge: 32,
  contentMax: 560,
} as const;
export const type = {
  display: {
    fontFamily: fonts.wideBlack,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fonts.wideBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: fonts.wideBold,
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
} satisfies Record<string, TextStyle>;
export const elevation = {
  floating: {
    shadowColor: '#0C2416',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  sheet: {
    shadowColor: '#0C2416',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
