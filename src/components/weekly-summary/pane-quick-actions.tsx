import { StyleSheet, Text, View } from 'react-native';

import {
  Body,
  Eyebrow,
  PaneLayout,
  Reveal,
  StoryNumber,
  Title,
  storyText,
} from '@/components/weekly-summary/story-atoms';
import { Ink, PaneSkins } from '@/components/weekly-summary/story-theme';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { quickActionFlavor, quickActionsHeadline } from '@/lib/weekly-summary-copy';
import type { WeeklyQuickActions, WeeklyStats } from '@/types/api';

const MAX_ROWS = 5;

export function PaneQuickActions({ data }: { data: WeeklyStats }) {
  const rows = data.quickActionsByUser.slice(0, MAX_ROWS);

  return (
    <PaneLayout>
      <Reveal order={0}>
        <Eyebrow>Småjobber</Eyebrow>
      </Reveal>
      <Reveal order={1} style={styles.title}>
        <Title>{quickActionsHeadline(data.quickActions)}</Title>
      </Reveal>
      <Reveal order={2} style={styles.subtitle}>
        <Body>De små tingene som holder kollektivet i gang.</Body>
      </Reveal>

      <View style={styles.list}>
        {rows.length === 0 ? (
          <Reveal order={4}>
            <Text style={[storyText.body, styles.empty]}>
              Ingen rakk en småjobb denne uken. Det tar seg fort opp.
            </Text>
          </Reveal>
        ) : (
          rows.map((entry, index) => (
            <Reveal key={entry.userId} order={4 + index}>
              <QuickActionRow entry={entry} order={4 + index} weekStart={data.weekStart} />
            </Reveal>
          ))
        )}
      </View>
    </PaneLayout>
  );
}

function QuickActionRow({
  entry,
  order,
  weekStart,
}: {
  entry: WeeklyQuickActions;
  order: number;
  weekStart: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.edge} />
      <StoryNumber value={entry.count} order={order} style={styles.count} />
      <View style={styles.rowText}>
        <Text style={storyText.rowTitle} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={storyText.rowMeta} numberOfLines={2}>
          {quickActionFlavor(entry, weekStart)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.two,
  },
  subtitle: {
    paddingTop: Spacing.one,
  },
  list: {
    flex: 1,
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    borderRadius: Radii.card,
    backgroundColor: Ink.surface,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three - 2,
    paddingVertical: Spacing.two + 2,
    overflow: 'hidden',
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: PaneSkins.quickActions.accent,
  },
  count: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    minWidth: 22,
    color: Ink.primary,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  empty: {
    color: Ink.secondary,
  },
});
