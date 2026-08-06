import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'heading'
    | 'eyebrow'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // Eyebrows and links default to their semantic colors unless overridden.
  const defaultColor: ThemeColor =
    themeColor ?? (type === 'eyebrow' ? 'textSecondary' : type === 'linkPrimary' ? 'brand' : 'text');

  return (
    <Text
      style={[
        { color: theme[defaultColor] },
        type === 'default' && styles.default,
        type === 'display' && styles.display,
        type === 'title' && styles.title,
        type === 'heading' && styles.heading,
        type === 'eyebrow' && styles.eyebrow,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// NOTE: custom fonts don't synthesize weights on Android — always pick the
// family, never set fontWeight alongside these styles.
const styles = StyleSheet.create({
  small: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 20,
  },
  default: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  display: {
    fontFamily: FontFamily.semiBold,
    fontSize: 30,
    lineHeight: 40,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 44,
    lineHeight: 54,
  },
  heading: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    lineHeight: 25,
  },
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 28,
    lineHeight: 40,
  },
  link: {
    fontFamily: FontFamily.medium,
    lineHeight: 30,
    fontSize: 13,
  },
  linkPrimary: {
    fontFamily: FontFamily.semiBold,
    lineHeight: 30,
    fontSize: 13,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
