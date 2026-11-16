import type { TextStyle, ViewStyle } from 'react-native';

// RideCore design system, taken from the "RideCore · Components" Figma file:
// warm off-white pages, white sheets and cards, near-black primary actions
// with an orange action circle, orange for selection, routes and pins.
export const colors = {
  // Brand accent: selection, route lines, pins, the action circle.
  brand: '#EF7B28',
  brandPressed: '#D9691A',
  brandSoft: '#FFF4E8',
  onBrand: '#191919', // dark text/icons on the orange accent
  // Primary actions are near-black.
  ink: '#191919',
  inkPressed: '#333333',
  onInk: '#FFFFFF',
  // Surfaces
  canvas: '#FAF9F6', // page background
  surface: '#FFFFFF', // sheets, cards, lists
  neutral: '#F3F2EE', // fields, icon tiles
  border: '#DEDCD8',
  // Text
  text: '#191919',
  secondary: '#65635F',
  muted: '#777673',
  inverse: '#FFFFFF',
  // Status
  success: '#1E7A46',
  successSoft: '#E6F4EC',
  error: '#B42332',
  errorSoft: '#FCECEE',
  disabled: '#E9E7E3',
  disabledText: '#65635F',
  scrim: 'rgba(25, 25, 25, 0.45)',
  // Home header gradient, left to right.
  heroStart: '#F7C76A',
  heroMid: '#F2A048',
  heroEnd: '#EF7C29',
} as const;

// Inter (SIL OFL 1.1), bundled in assets/fonts. Android needs one family
// name per weight, so the weight lives in the family name.
export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  mediumItalic: 'Inter-MediumItalic',
  boldItalic: 'Inter-BoldItalic',
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
export const radius = {
  sm: 8,
  md: 12, // buttons, fields, cards
  tile: 10, // 40px icon tiles
  lg: 16,
  sheet: 24,
  pill: 999,
} as const;
export const size = {
  touch: 56, // primary button height
  input: 60, // field height
  back: 48, // back button
  tile: 40, // icon tile
  icon: 24,
  iconSmall: 20,
  iconLarge: 32,
  contentMax: 560,
} as const;
// Type scale from the Figma text styles (RideCore/Display, Body, Caption).
export const type = {
  display: {
    fontFamily: fonts.medium,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.8,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.9,
  },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
} satisfies Record<string, TextStyle>;
export const elevation = {
  floating: {
    shadowColor: '#191919',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sheet: {
    shadowColor: '#191919',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
