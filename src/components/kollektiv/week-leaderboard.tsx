import { StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import type { WeeklyQuickActions, WeeklyStats, WeeklyTask } from '@/types/api';

type Props = {
  leaderboard: WeeklyStats['leaderboard'];
  tasks: WeeklyTask[];
  quickActionsByUser: WeeklyQuickActions[];
  meId: number | undefined;
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function WeekLeaderboard({ leaderboard, tasks, quickActionsByUser, meId }: Props) {
  return (
    <View>
      {leaderboard.map((member, index) => {
        const taskCount = tasks.filter(
          (task) => task.assigneeUserId === member.userId && task.completed
        ).length;
        const quickCount =
          quickActionsByUser.find((entry) => entry.userId === member.userId)?.count ?? 0;
        const hasDone = taskCount > 0 || quickCount > 0;

        return (
          <View key={member.userId} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
              {index + 1}
            </ThemedText>

            <AvatarBadge
              userId={member.userId}
              name={member.name}
              pictureUrl={member.pictureUrl}
              shape="circle"
              size={36}
            />

            <View style={styles.text}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {member.name}
                {member.userId === meId && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {' · deg'}
                  </ThemedText>
                )}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {hasDone
                  ? [
                      taskCount > 0 ? plural(taskCount, 'oppgave', 'oppgaver') : null,
                      quickCount > 0 ? plural(quickCount, 'småjobb', 'småjobber') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Ikke begynt ennå'}
              </ThemedText>
            </View>

            <ThemedText type="smallBold" style={styles.points}>
              {member.weekPoints} p
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
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  rank: {
    width: 12,
    fontVariant: ['tabular-nums'],
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  points: {
    fontFamily: FontFamily.semiBold,
    fontVariant: ['tabular-nums'],
  },
});
