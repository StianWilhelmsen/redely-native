import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyStats } from '@/types/api';

/** Whole days left in the Mon-Sun week, counting today as one of them. */
function daysLeftInWeek(weekEnd: string): number {
  const end = new Date(`${weekEnd}T23:59:59`);
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * The collective's shared weekly points target, as one line and one hairline bar.
 * Deliberately framed as something everyone fills together rather than a ranking -
 * points are co-op here, so there is nothing to gain by inflating your own tasks.
 *
 * Doubles as the entry point into the animated weekly story: it is the number the
 * story opens on, so tapping the number is the obvious way in.
 */
export function WeeklyGoalBar({ stats }: { stats: WeeklyStats }) {
  const theme = useTheme();

  if (stats.goalPoints <= 0) return null;

  const percent = Math.min(100, Math.round((stats.totalPoints / stats.goalPoints) * 100));
  const reached = stats.totalPoints >= stats.goalPoints;
  const days = daysLeftInWeek(stats.weekEnd);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ukemål: ${stats.totalPoints} av ${stats.goalPoints} poeng. Se ukesoppsummeringen.`}
      onPress={() => router.push('/weekly-summary')}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      <View style={styles.row}>
        <ThemedText type="small" numberOfLines={1} style={styles.label}>
          <ThemedText type="smallBold">Ukemål </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {stats.totalPoints} av {stats.goalPoints} poeng sammen
          </ThemedText>
        </ThemedText>
        <View style={styles.trailing}>
          <ThemedText type="small" themeColor="textSecondary">
            {reached ? 'Målet er nådd' : days === 0 ? 'Siste dag' : `${days} dager igjen`}
          </ThemedText>
          <Ionicons name="chevron-forward" size={13} color={theme.textSecondary} />
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            { width: `${percent}%`, backgroundColor: reached ? theme.success : theme.brand },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  label: {
    flexShrink: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
