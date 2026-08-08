import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyStats } from '@/types/api';

/**
 * The collective's shared weekly points target. Deliberately framed as one bar everyone
 * fills together rather than a ranking - points are co-op here, so there's nothing to be
 * gained by inflating your own tasks.
 *
 * Doubles as the app's main entry point into the animated weekly story: it's the first
 * thing anyone sees on Hjem, and already shows the exact live number the story opens on.
 */
export function WeeklyGoalSection({ stats }: { stats: WeeklyStats }) {
  const theme = useTheme();

  if (stats.goalPoints <= 0) return null;

  const percent = Math.min(100, Math.round((stats.totalPoints / stats.goalPoints) * 100));
  const remaining = Math.max(0, stats.goalPoints - stats.totalPoints);
  const reached = remaining === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Se ukesoppsummeringen"
      onPress={() => router.push('/weekly-summary')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.header}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Ukemål sammen
        </ThemedText>
        <View style={styles.headerRight}>
          <ThemedText type="smallBold" themeColor={reached ? 'success' : 'textSecondary'}>
            {percent}%
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </View>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
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
