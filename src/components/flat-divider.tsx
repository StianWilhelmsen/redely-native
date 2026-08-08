import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Full-width hairline, no leading inset - for flows that sit directly on the background
 *  rather than a list of rows (unlike Section's own `Separator`, which insets for one). */
export function FlatDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
