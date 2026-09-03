import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';

export type HomeStat = {
  label: string;
  value: number;
  caption: string;
  /** Highlight this stat's number in the brand colour (use for at most one). */
  emphasize?: boolean;
};

/** Three numbers straight on the background - no card, no dividers. The only colour is
 *  on the one number that says what to do next. */
export function TodayStats({ stats }: { stats: HomeStat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.cell}>
          <AnimatedNumber
            value={stat.value}
            themeColor={stat.emphasize ? 'brand' : 'text'}
            style={styles.value}
          />
          <ThemedText type="smallBold" style={styles.label}>
            {stat.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
            {stat.caption}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  cell: {
    flex: 1,
  },
  value: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  label: {
    marginTop: Spacing.half,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
});
