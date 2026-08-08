import { StyleSheet, Text, View } from 'react-native';

import {
  Body,
  Eyebrow,
  PaneLayout,
  Reveal,
  StoryAvatar,
  Title,
  storyText,
} from '@/components/weekly-summary/story-atoms';
import { Ink } from '@/components/weekly-summary/story-theme';
import { FontFamily, Spacing } from '@/constants/theme';
import { coverTitle, formatWeekRange } from '@/lib/weekly-summary-copy';
import type { WeeklyStats } from '@/types/api';

const MAX_FACES = 5;

export function PaneCover({ data, isFinished }: { data: WeeklyStats; isFinished: boolean }) {
  const faces = data.leaderboard.slice(0, MAX_FACES);
  const overflow = data.leaderboard.length - faces.length;

  return (
    <PaneLayout>
      <View style={styles.body}>
        <Reveal order={0}>
          <Eyebrow>Ukesoppsummering</Eyebrow>
        </Reveal>
        <Reveal order={1} style={styles.title}>
          <Title>{coverTitle(isFinished)}</Title>
        </Reveal>
        <Reveal order={3} style={styles.subtitle}>
          <Body>
            {data.collectiveName ? `${data.collectiveName} · ` : ''}
            {formatWeekRange(data.weekStart, data.weekEnd)}
          </Body>
        </Reveal>
        <Reveal order={4} style={styles.faces}>
          {faces.map((member, index) => (
            <View key={member.userId} style={index > 0 ? styles.faceOverlap : undefined}>
              <StoryAvatar
                userId={member.userId}
                name={member.name}
                pictureUrl={member.pictureUrl}
                size={34}
              />
            </View>
          ))}
          {overflow > 0 && (
            <View style={[styles.faceOverlap, styles.overflowBadge]}>
              <Text style={styles.overflowText}>{`+${overflow}`}</Text>
            </View>
          )}
        </Reveal>
      </View>

      <Reveal order={7}>
        <Text style={[storyText.body, styles.hint]}>Trykk for å bla ›</Text>
      </Reveal>
    </PaneLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    paddingTop: Spacing.three,
  },
  subtitle: {
    paddingTop: Spacing.two,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.four,
  },
  faceOverlap: {
    marginLeft: -Spacing.two,
  },
  overflowBadge: {
    height: 34,
    minWidth: 34,
    paddingHorizontal: Spacing.two,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Ink.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Ink.hairline,
  },
  overflowText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: Ink.primary,
  },
  hint: {
    color: Ink.muted,
    fontSize: 13,
  },
});
