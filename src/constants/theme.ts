/**
 * Below are the colors that are used in the app. Colors are grouped into named
 * palettes, each with a light and dark variant. See `@/theme/palette-context`
 * for how the active palette is selected and switched at runtime.
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

export type PaletteId = 'redely' | 'warmClay' | 'boldCitrus' | 'deepPlum' | 'inkAmber';

export const Palettes: Record<PaletteId, { light: PaletteTokens; dark: PaletteTokens }> = {
  /**
   * The app's own look, from the 2026-09 redesign. Surfaces are deliberately neutral -
   * paper-white in light, near-black in dark - so the coral brand is the only saturated
   * color on screen and always reads as "this is the action".
   */
  redely: {
    light: {
      text: '#1A1A1A',
      textSecondary: '#8A8279',
      background: '#FFFFFF',
      backgroundElement: '#F5F0EA',
      backgroundSelected: '#EDE7DF',
      border: '#E9E3DA',
      brand: '#E05F4A',
      onBrand: '#FFFFFF',
      brandSecondary: '#B84632',
      success: '#4E9B6C',
      danger: '#C24632',
    },
    dark: {
      text: '#F7F5F3',
      textSecondary: '#8E8A86',
      background: '#121212',
      backgroundElement: '#1E1E1E',
      backgroundSelected: '#282828',
      border: '#2E2E2E',
      brand: '#E8776A',
      onBrand: '#231110',
      brandSecondary: '#F0A08F',
      success: '#6FBF8B',
      danger: '#E4574A',
    },
  },
  warmClay: {
    light: {
      text: '#2B2420',
      textSecondary: '#7A6F63',
      background: '#F5EEE1',
      backgroundElement: '#FFFDF9',
      backgroundSelected: '#EFE2CD',
      border: '#E8DCC8',
      brand: '#C1622A',
      onBrand: '#FFF6EC',
      brandSecondary: '#E8A24C',
      success: '#5B8C5A',
      danger: '#C1452E',
    },
    dark: {
      text: '#F5EDE4',
      textSecondary: '#B8AA9A',
      background: '#1C1712',
      backgroundElement: '#26201A',
      backgroundSelected: '#322A21',
      border: '#3A3128',
      brand: '#E08A4F',
      onBrand: '#2A1608',
      brandSecondary: '#F0BC72',
      success: '#7BAF79',
      danger: '#E07257',
    },
  },
  boldCitrus: {
    light: {
      text: '#16202F',
      textSecondary: '#5C6470',
      background: '#F1F1E6',
      backgroundElement: '#FEFEFA',
      backgroundSelected: '#E7E7D8',
      border: '#E4E4D8',
      brand: '#8FBE2E',
      onBrand: '#16202F',
      brandSecondary: '#1C2B4A',
      success: '#3FA76A',
      danger: '#E14F4F',
    },
    dark: {
      text: '#F2F4EC',
      textSecondary: '#9AA3AE',
      background: '#10151F',
      backgroundElement: '#1A2130',
      backgroundSelected: '#232C3F',
      border: '#2B3446',
      brand: '#C3EE5E',
      onBrand: '#10151F',
      brandSecondary: '#7FA8E0',
      success: '#5FCB8B',
      danger: '#F1786F',
    },
  },
  deepPlum: {
    light: {
      text: '#2B1E31',
      textSecondary: '#75647E',
      background: '#F3EAF2',
      backgroundElement: '#FFFCFE',
      backgroundSelected: '#EBDCEA',
      border: '#E2D3E4',
      brand: '#C9573F',
      onBrand: '#FFF3EF',
      brandSecondary: '#8B5FA0',
      success: '#4E9B6C',
      danger: '#C24632',
    },
    dark: {
      text: '#F5EDE8',
      textSecondary: '#B7A8C0',
      background: '#211527',
      backgroundElement: '#2E1F36',
      backgroundSelected: '#3A2841',
      border: '#43314D',
      brand: '#E8785F',
      onBrand: '#2B120C',
      brandSecondary: '#C9A6D9',
      success: '#6FBF8B',
      danger: '#E4574A',
    },
  },
  inkAmber: {
    light: {
      text: '#1E1D16',
      textSecondary: '#6E6C5E',
      background: '#F2ECDB',
      backgroundElement: '#FFFEF9',
      backgroundSelected: '#EAE2C9',
      border: '#E6E0CE',
      brand: '#B97A1F',
      onBrand: '#FFF7E8',
      brandSecondary: '#8A5A18',
      success: '#5B8C4A',
      danger: '#B84D34',
    },
    dark: {
      text: '#F2EFE6',
      textSecondary: '#9A9A8E',
      background: '#12130F',
      backgroundElement: '#1C1D18',
      backgroundSelected: '#262720',
      border: '#33342C',
      brand: '#F0A83C',
      onBrand: '#231604',
      brandSecondary: '#D98A2B',
      success: '#7FB86A',
      danger: '#E0654A',
    },
  },
};

export const PaletteMeta: { id: PaletteId; name: string; description: string }[] = [
  { id: 'redely', name: 'Redely', description: 'Coral on paper and ink. The signature look.' },
  { id: 'deepPlum', name: 'Deep Plum', description: 'Aubergine and coral. Moody and premium.' },
  { id: 'warmClay', name: 'Warm Clay', description: 'Terracotta on warm cream. Cozy and domestic.' },
  { id: 'boldCitrus', name: 'Bold Citrus', description: 'Lime and navy. Playful and game-like.' },
  { id: 'inkAmber', name: 'Ink & Amber', description: 'Ink black and amber. Calm, low-glare.' },
];

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
 * Fixed categorical colors for per-member avatar badges. Independent of the active
 * brand palette on purpose — members need to stay visually distinct from each other
 * (and from the brand color) regardless of which of the 4 palettes is selected.
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
