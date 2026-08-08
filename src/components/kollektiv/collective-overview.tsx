import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { FlatDivider } from '@/components/flat-divider';
import { FlatStatRow } from '@/components/flat-stat-row';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  collectiveName: string;
  collectivePictureUrl: string | null;
  memberCount: number;
  weekNumber: number;
  onSettingsPress: () => void;

  goalStreakWeeks: number;
  totalPoints: number;
  goalPoints: number;
  daysLeftInWeek: number;
  plannedTasksCompleted: number;
  plannedTasks: number;
  quickActions: number;
};

/** Identity, shared weekly goal and this week's headline stats - the Kollektiv-tab
 *  counterpart to Meg's ProfileOverview, built from the same flat primitives. */
export function CollectiveOverview({
  collectiveName,
  collectivePictureUrl,
  memberCount,
  weekNumber,
  onSettingsPress,
  goalStreakWeeks,
  totalPoints,
  goalPoints,
  daysLeftInWeek,
  plannedTasksCompleted,
  plannedTasks,
  quickActions,
}: Props) {
  const theme = useTheme();
  const percent = goalPoints > 0 ? Math.max(0, Math.min(100, Math.round((totalPoints / goalPoints) * 100))) : 0;

  return (
    <View style={styles.root}>
      <View style={styles.identityRow}>
        <CollectiveAvatar pictureUrl={collectivePictureUrl} size={56} />

        <View style={styles.identityText}>
          <ThemedText type="heading" numberOfLines={1}>
            {collectiveName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {memberCount} medlem{memberCount === 1 ? '' : 'mer'} · uke {weekNumber}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kollektivinnstillinger"
          onPress={onSettingsPress}
          hitSlop={Spacing.two}>
          <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      {goalStreakWeeks > 0 && (
        <View style={[styles.streakPill, { backgroundColor: `${theme.brandSecondary}26` }]}>
          <ThemedText style={styles.streakEmoji}>🔥</ThemedText>
          <ThemedText type="smallBold">
            {goalStreakWeeks} {goalStreakWeeks === 1 ? 'uke' : 'uker'} uten etterslep
          </ThemedText>
        </View>
      )}

      <FlatDivider />

      <View style={styles.goalBlock}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Felles ukesmål
        </ThemedText>
        <View style={styles.goalNumbersRow}>
          <View style={styles.goalNumbersLeft}>
            <AnimatedNumber value={totalPoints} type="title" style={styles.bigNumber} />
            <ThemedText type="small" themeColor="textSecondary">
              av {goalPoints} poeng
            </ThemedText>
          </View>
          <View style={styles.goalNumbersRight}>
            <ThemedText type="heading" style={styles.daysLeftNumber}>
              {daysLeftInWeek}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {daysLeftInWeek === 1 ? 'dag igjen' : 'dager igjen'}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.fill,
              { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.success : theme.brand },
            ]}
          />
        </View>
      </View>

      <FlatDivider />

      <FlatStatRow
        items={[
          { value: totalPoints, label: 'poeng denne uka', accent: true },
          { value: plannedTasksCompleted, label: `av ${plannedTasks} faste oppgaver` },
          { value: quickActions, label: 'småjobber' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  streakPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.one + 2,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.one + 2,
  },
  streakEmoji: {
    fontSize: 15,
  },
  goalBlock: {
    gap: Spacing.two,
  },
  goalNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalNumbersLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  bigNumber: {
    fontSize: 40,
    lineHeight: 46,
  },
  goalNumbersRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  daysLeftNumber: {
    fontSize: 22,
    lineHeight: 26,
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
