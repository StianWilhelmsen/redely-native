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
  /** The fridge door every screen sits on. Same as `background`, named for intent. */
  door: string;
  /** Plain note paper; also the surface for cards, inputs and sheets. */
  paper: string;
  paperYellow: string;
  paperPink: string;
  paperMint: string;
  /** Text printed on any paper colour - paper keeps its own ink in dark mode too. */
  paperInk: string;
  /** The "gjort!" stamp. */
  stamp: string;
  /** Magne's red - reserved for the mascot, the + button and Pluss. */
  magne: string;
  /** The dark pill tab bar and primary buttons. */
  ink: string;
  onInk: string;
};

/**
 * Magneten has one look - the fridge door - in two schemes. Colours come from the design
 * canvas ("Kjøleskapsdøra · designsystem"); keep the two in step when either changes.
 */
export const Theme: { light: PaletteTokens; dark: PaletteTokens } = {
  light: {
    text: '#1B2326',
    textSecondary: '#55666B',
    background: '#DCE6E8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEF2F3',
    border: '#C9D3D6',
    brand: '#E8402A',
    onBrand: '#FFFFFF',
    brandSecondary: '#B92C1A',
    success: '#1E7A4F',
    danger: '#B92C1A',
    door: '#DCE6E8',
    paper: '#FFFFFF',
    paperYellow: '#FFE873',
    paperPink: '#FFC6D3',
    paperMint: '#C9F0DD',
    paperInk: '#1B2326',
    stamp: '#1E7A4F',
    magne: '#E8402A',
    ink: '#1B2326',
    onInk: '#FFFFFF',
  },
  dark: {
    text: '#E6ECEE',
    textSecondary: '#93A3A8',
    background: '#161E21',
    backgroundElement: '#2B3539',
    backgroundSelected: '#243034',
    border: '#2E3A3E',
    brand: '#FF5A43',
    onBrand: '#FFFFFF',
    brandSecondary: '#FF8A78',
    success: '#5FD39A',
    danger: '#FF8A78',
    door: '#161E21',
    paper: '#2B3539',
    paperYellow: '#4D4419',
    paperPink: '#4A2732',
    paperMint: '#1F3D33',
    paperInk: '#EEF2F3',
    stamp: '#5FD39A',
    magne: '#FF5A43',
    ink: '#0D1315',
    onInk: '#FFFFFF',
  },
};

export type ThemeColor = keyof PaletteTokens;

/**
 * Rethink Sans for everything you operate, Kalam (handwriting) only for what is "on the
 * door": note titles, screen titles and Magne's lines. Custom fonts need an explicit
 * family per weight - React Native does not synthesize bold.
 */
export const FontFamily = {
  regular: 'RethinkSans_400Regular',
  medium: 'RethinkSans_500Medium',
  semiBold: 'RethinkSans_600SemiBold',
  bold: 'RethinkSans_700Bold',
  extraBold: 'RethinkSans_800ExtraBold',
  hand: 'Kalam_700Bold',
  handRegular: 'Kalam_400Regular',
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
 * Magnet colours - one per household member, used as the ring of their photo magnet.
 * Deliberately outside the theme: a person keeps their colour in both schemes. Red is
 * left out on purpose; it belongs to Magne. The backend validates against this same list.
 */
export const MemberColors = [
  '#2F5BD8', // blå
  '#7A4FD6', // lilla
  '#1A9AA6', // petrol
  '#E8B400', // sennep
  '#E0559A', // rosa
  '#5E9E2E', // gress
] as const;

export function memberColor(userId: number): string {
  return MemberColors[Math.abs(userId) % MemberColors.length];
}
