import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, memberColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyStats } from '@/types/api';

/**
 * Names the one or two people with the least on the board this week. Phrased as capacity
 * ("har mest ledig") rather than as a shortfall on purpose: the goal is shared, so the
 * useful thing to say is where the remaining points could come from, not who is behind.
 */
function whoHasRoom(leaderboard: WeeklyStats['leaderboard']): string | null {
  if (leaderboard.length < 2) return null;
  const names = [...leaderboard]
    .sort((a, b) => a.weekPoints - b.weekPoints)
    .slice(0, 2)
    .map((member) => member.name.split(' ')[0]);
  if (names.length === 0) return null;
  return names.length === 1 ? names[0] : `${names[0]} og ${names[1]}`;
}

export function SharedGoal({ stats, daysLeft }: { stats: WeeklyStats; daysLeft: number }) {
  const theme = useTheme();

  const remaining = Math.max(0, stats.goalPoints - stats.totalPoints);
  const reached = remaining === 0;
  const room = whoHasRoom(stats.leaderboard);

  // One segment per contributor, in their own colour: the bar shows how far along the
  // collective is and who got it there, in the same glance.
  const contributors = stats.leaderboard.filter((member) => member.weekPoints > 0);

  return (
    <View style={styles.root}>
      <ThemedText type="eyebrow">Felles ukemål</ThemedText>

      <View style={styles.headline}>
        <View style={styles.pointsRow}>
          <ThemedText style={[styles.points, { color: theme.text }]}>{stats.totalPoints}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            av {stats.goalPoints} poeng
          </ThemedText>
        </View>
        <View style={styles.daysColumn}>
          <ThemedText style={[styles.days, { color: theme.text }]}>{daysLeft}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {daysLeft === 1 ? 'dag igjen' : 'dager igjen'}
          </ThemedText>
        </View>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: stats.goalPoints, now: stats.totalPoints }}
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        {contributors.map((member) => (
          <View
            key={member.userId}
            style={{
              flex: member.weekPoints,
              backgroundColor: memberColor(member.userId),
            }}
          />
        ))}
        {remaining > 0 && <View style={{ flex: remaining }} />}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {reached
          ? 'Målet er nådd — bra jobba! 🎉'
          : room
            ? `${remaining} poeng igjen – ${room} har mest ledig`
            : `${remaining} poeng igjen denne uka`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    flexShrink: 1,
  },
  points: {
    fontFamily: FontFamily.bold,
    fontSize: 38,
    lineHeight: 44,
  },
  daysColumn: {
    alignItems: 'flex-end',
  },
  days: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
