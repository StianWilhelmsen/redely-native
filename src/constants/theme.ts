/**
 * The app's colour tokens, in a light and a dark variant. See `@/theme/palette-context`
 * for how the active scheme is chosen (device setting, or an explicit choice).
 */

import '@/global.css';

import { Platform } from 'react-native';

export type PaletteTokens = {
  text: string;
  textSecondary: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  border: string;
  brand: string;
  /** Text/icon color that stays legible on a `brand`-colored surface. */
  onBrand: string;
  brandSecondary: string;
  success: string;
  danger: string;
};

/**
 * The app has one look, in two schemes. There used to be four selectable palettes; the
 * redesign replaced them with a single signature set, and a stored choice from the old
 * switcher would otherwise have kept overriding it with no way left to change it back.
 */
export const Theme: { light: PaletteTokens; dark: PaletteTokens } = {
  light: {
    text: '#1F1B18',
    textSecondary: '#8A7F76',
    background: '#FFFFFF',
    backgroundElement: '#F6F1EA',
    backgroundSelected: '#F1EBE3',
    border: '#EFE8DF',
    brand: '#E9604F',
    onBrand: '#FFFFFF',
    brandSecondary: '#B8483A',
    success: '#4E9B6C',
    danger: '#C24632',
  },
  dark: {
    text: '#F1ECE6',
    textSecondary: '#8F8781',
    background: '#141316',
    backgroundElement: '#1F1E23',
    // Tiles and hairlines share one value in dark: at these sizes a filled tile and a
    // rule are the same gesture - a step up off the background.
    backgroundSelected: '#26242A',
    border: '#26242A',
    brand: '#F07A6A',
    onBrand: '#2A1A16',
    brandSecondary: '#F5A093',
    success: '#6FBF8B',
    danger: '#E4574A',
  },
};

export type ThemeColor = keyof PaletteTokens;

/** Poppins weight map — custom fonts need explicit families per weight (no synthesized bold). */
export const FontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 76, android: 84 }) ?? 76;
export const MaxContentWidth = 800;

/**
 * One height and one radius for every control on the auth and onboarding screens, so
 * inputs, buttons and provider tiles stack into a single column with no visual seams.
 */
export const Control = {
  height: 52,
  radius: 14,
} as const;

/** Shared corner-radius scale — every rounded surface should reference one of these. */
export const Radii = {
  chip: 12,
  input: 14,
  card: 18,
  sheet: 28,
  pill: 999,
} as const;

/**
 * Fixed categorical colours for per-member avatar badges. Deliberately outside the theme:
 * members need to stay distinct from each other and from the brand colour, in both
 * schemes, so these do not shift with light and dark.
 */
export const MemberColors = [
  '#4E8A6B', // green
  '#C1622A', // terracotta
  '#7C5FA6', // purple
  '#3F7CAC', // blue
  '#A68A2E', // olive gold
  '#B4526C', // rose
] as const;

export function memberColor(userId: number): string {
  return MemberColors[Math.abs(userId) % MemberColors.length];
}
