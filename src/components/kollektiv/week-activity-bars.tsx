import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DayCount } from '@/types/api';

const TRACK_HEIGHT = 56;

/** Static weekly activity bars: every day gets a light brand tint, the busiest day gets
 *  full brand color. No interaction (unlike home's BarChart) - this is a glance, not a
 *  chart to dig into. */
export function WeekActivityBars({ data }: { data: DayCount[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((d) => d.count));
  const bestIndex = data.reduce(
    (best, d, i) => (d.count > (data[best]?.count ?? 0) ? i : best),
    -1
  );

  return (
    <View style={styles.row}>
      {data.map((d, index) => {
        const height = d.count > 0 ? Math.max(6, Math.round((d.count / max) * TRACK_HEIGHT)) : 3;
        const isBest = index === bestIndex && d.count > 0;
        return (
          <View key={`${d.day}-${index}`} style={styles.col}>
            <View style={[styles.track, { height: TRACK_HEIGHT }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: isBest ? theme.brand : d.count > 0 ? `${theme.brand}40` : theme.border,
                  },
                ]}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {d.day.charAt(0)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  track: {
    width: '100%',
    maxWidth: 28,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
  },
});
