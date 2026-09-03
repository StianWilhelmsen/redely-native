import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HomeStat = {
  label: string;
  value: number;
  caption: string;
  /** Highlight this stat's number in the brand colour (use for at most one). */
  emphasize?: boolean;
};

/** Three numbers straight on the background, centred in equal columns with hairlines
 *  between them. The only colour is on the one number that says what to do next. */
export function TodayStats({ stats }: { stats: HomeStat[] }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.cellWrap}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          <View style={styles.cell}>
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
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cellWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
  },
  label: {
    marginTop: Spacing.half,
    fontSize: 15,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
});
