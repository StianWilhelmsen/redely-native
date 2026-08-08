import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { FlatDivider } from '@/components/flat-divider';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UserStats, WeeklyQuickActions } from '@/types/api';

/** This week's points leaderboard - replaces the old month-scoped, completion-count
 *  leaderboard, so every number on this page now tells the same week's story. */
export function WeekLeaderboard({
  leaderboard,
  quickActionsByUser,
}: {
  leaderboard: UserStats[];
  quickActionsByUser: WeeklyQuickActions[];
}) {
  const theme = useTheme();

  return (
    <View>
      {leaderboard.map((member, index) => {
        const isMvp = member.badges.some((badge) => badge.code === 'MVP');
        const quickCount = quickActionsByUser.find((entry) => entry.userId === member.userId)?.count ?? 0;
        return (
          <Fragment key={member.userId}>
            {index > 0 && <FlatDivider />}
            <View style={styles.row}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
                {index + 1}
              </ThemedText>
              <AvatarBadge userId={member.userId} name={member.name} pictureUrl={member.pictureUrl} size={34} />
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                    {member.name}
                  </ThemedText>
                  {isMvp && (
                    <View style={[styles.mvpBadge, { backgroundColor: `${theme.brandSecondary}33` }]}>
                      <ThemedText type="small" style={{ color: theme.brandSecondary }}>
                        MVP
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {quickCount} {quickCount === 1 ? 'småjobb' : 'småjobber'}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{member.weekPoints} p</ThemedText>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rank: {
    width: 16,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    flexShrink: 1,
  },
  mvpBadge: {
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
  },
});
