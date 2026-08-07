import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyStats } from '@/types/api';

/**
 * The collective's shared weekly points target. Deliberately framed as one bar everyone
 * fills together rather than a ranking - points are co-op here, so there's nothing to be
 * gained by inflating your own tasks.
 */
export function WeeklyGoalSection({ stats }: { stats: WeeklyStats }) {
  const theme = useTheme();

  if (stats.goalPoints <= 0) return null;

  const percent = Math.min(100, Math.round((stats.totalPoints / stats.goalPoints) * 100));
  const remaining = Math.max(0, stats.goalPoints - stats.totalPoints);
  const reached = remaining === 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Ukemål sammen
        </ThemedText>
        <ThemedText type="smallBold" themeColor={reached ? 'success' : 'textSecondary'}>
          {percent}%
        </ThemedText>
      </View>

      <View style={styles.amountRow}>
        <AnimatedNumber
          value={stats.totalPoints}
          type="display"
          themeColor={reached ? 'success' : 'brand'}
          style={styles.amount}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.amountSuffix}>
          av {stats.goalPoints} poeng
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            { width: `${percent}%`, backgroundColor: reached ? theme.success : theme.brand },
          ]}
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {reached ? 'Målet er nådd — bra jobba! 🎉' : `${remaining} poeng igjen denne uka`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  amount: {
    fontSize: 32,
    lineHeight: 38,
  },
  amountSuffix: {
    flexShrink: 1,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
