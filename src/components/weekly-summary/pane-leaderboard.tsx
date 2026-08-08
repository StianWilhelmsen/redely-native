import { StyleSheet, Text, View } from 'react-native';

import {
  Eyebrow,
  PaneLayout,
  Reveal,
  StoryAvatar,
  StoryBar,
  Title,
  storyText,
} from '@/components/weekly-summary/story-atoms';
import { Ink, PaneSkins } from '@/components/weekly-summary/story-theme';
import { FontFamily, Spacing } from '@/constants/theme';
import { leaderboardHeadline } from '@/lib/weekly-summary-copy';
import type { UserStats, WeeklyStats } from '@/types/api';

const MAX_ROWS = 5;

export function PaneLeaderboard({ data }: { data: WeeklyStats }) {
  const rows = data.leaderboard.slice(0, MAX_ROWS);
  const top = Math.max(1, ...rows.map((member) => member.weekPoints));

  return (
    <PaneLayout>
      <Reveal order={0}>
        <Eyebrow>Poengtavle</Eyebrow>
      </Reveal>
      <Reveal order={1} style={styles.title}>
        <Title>{leaderboardHeadline(data.leaderboard)}</Title>
      </Reveal>

      <View style={styles.list}>
        {rows.map((member, index) => (
          <Reveal key={member.userId} order={3 + index}>
            <LeaderRow
              member={member}
              rank={index + 1}
              percent={(member.weekPoints / top) * 100}
              order={3 + index}
              quickCount={
                data.quickActionsByUser.find((entry) => entry.userId === member.userId)?.count ?? 0
              }
            />
          </Reveal>
        ))}
      </View>

      <Reveal order={3 + rows.length + 1}>
        <Text style={[storyText.body, styles.footer]}>
          {`Fortsett sånn${data.collectiveName ? `, ${data.collectiveName}` : ''} ✌️`}
        </Text>
      </Reveal>
    </PaneLayout>
  );
}

function LeaderRow({
  member,
  rank,
  percent,
  order,
  quickCount,
}: {
  member: UserStats;
  rank: number;
  percent: number;
  order: number;
  quickCount: number;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rank}>{rank}</Text>
      <StoryAvatar
        userId={member.userId}
        name={member.name}
        pictureUrl={member.pictureUrl}
        size={30}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={storyText.rowTitle} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.points}>{`${member.weekPoints} p`}</Text>
        </View>
        <StoryBar percent={percent} order={order} color={PaneSkins.leaderboard.accent} height={5} />
        <Text style={storyText.rowMeta}>
          {`${quickCount} ${quickCount === 1 ? 'småjobb' : 'småjobber'}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.two,
  },
  list: {
    flex: 1,
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  rank: {
    width: 14,
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: Ink.faint,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  points: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Ink.primary,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    color: Ink.muted,
  },
});
