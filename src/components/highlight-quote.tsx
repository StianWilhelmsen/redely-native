import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A generated one-liner about something that actually happened, with a plain caption -
 *  used for both the Meg tab's own-activity highlight and the Kollektiv tab's collective
 *  one (which additionally credits whoever it was about). */
export function HighlightQuote({ text, caption }: { text: string; caption: string }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.quoteMark, { color: theme.brand }]}>❝</Text>
      <View style={styles.text}>
        <ThemedText style={styles.body}>{text}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quoteMark: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 22,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  body: {
    lineHeight: 21,
  },
});
