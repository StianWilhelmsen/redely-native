import { StyleSheet, View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ViewProps & {
  /**
   * Use sparingly — most content belongs directly on the background (see Section).
   * 'brand' is the one focal surface per screen; 'default' is a quiet fill for
   * grouped inputs; neither draws a border (fill OR border, never both).
   */
  tone?: 'default' | 'brand';
};

export function Card({ style, tone = 'default', ...rest }: Props) {
  const theme = useTheme();

  const toneStyle =
    tone === 'brand'
      ? { backgroundColor: `${theme.brand}1F` }
      : { backgroundColor: theme.backgroundElement };

  return <View style={[styles.card, toneStyle, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
