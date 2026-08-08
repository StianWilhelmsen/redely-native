import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  Eyebrow,
  PaneLayout,
  Reveal,
  StatTile,
  Title,
  revealAt,
  storyText,
  useStage,
} from '@/components/weekly-summary/story-atoms';
import { Ink, PaneSkins } from '@/components/weekly-summary/story-theme';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import {
  formatNextWeekStart,
  goalPercent,
  isoWeekNumber,
  recapHeadline,
  topDayCaption,
} from '@/lib/weekly-summary-copy';
import type { DayCount, WeeklyStats } from '@/types/api';

const CHART_HEIGHT = 76;
const DAY_INITIALS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

export type ShareState = 'idle' | 'sending' | 'sent' | 'failed';

export function PaneRecap({ data }: { data: WeeklyStats }) {
  const percent = goalPercent(data);

  return (
    <PaneLayout hasFooter>
      <Reveal order={0}>
        <Eyebrow>{`Uke ${isoWeekNumber(data.weekStart)} · Oppsummert`}</Eyebrow>
      </Reveal>
      <Reveal order={1} style={styles.title}>
        <Title>{recapHeadline(percent, data.collectiveName)}</Title>
      </Reveal>

      <View style={styles.middle}>
        <View style={styles.gridRow}>
          <StatTile order={3} value={`${data.totalPoints}/${data.goalPoints}`} label="Felles mål" />
          <StatTile
            order={4}
            value={`${data.plannedTasksCompleted}/${data.plannedTasks}`}
            label="Faste oppgaver"
          />
        </View>
        <View style={styles.gridRow}>
          <StatTile order={5} value={String(data.quickActions)} label="Småjobber" />
          <StatTile order={6} value={data.mvp?.name ?? '—'} label="Ukens MVP" />
        </View>

        <Reveal order={6} style={styles.chartCard}>
          <RecapBars days={data.dayCounts} />
          <Text style={[storyText.rowMeta, styles.caption]}>{topDayCaption(data)}</Text>
        </Reveal>
      </View>
    </PaneLayout>
  );
}

/** The interactive row the pager pins above its tap zones. */
export function RecapFooter({
  data,
  state,
  onShare,
}: {
  data: WeeklyStats;
  state: ShareState;
  onShare: () => void;
}) {
  const sent = state === 'sent';

  return (
    <Reveal order={9} style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: state === 'sending' || sent }}
        disabled={state === 'sending' || sent}
        onPress={onShare}
        style={({ pressed }) => [styles.shareButton, pressed && styles.sharePressed]}>
        {state === 'sending' ? (
          <ActivityIndicator color={PaneSkins.recap.gradient[0]} />
        ) : (
          <View style={styles.shareLabel}>
            {sent && <Ionicons name="checkmark" size={16} color={PaneSkins.recap.gradient[0]} />}
            <Text style={styles.shareText}>{sent ? 'Delt i chatten' : 'Del med kollektivet'}</Text>
          </View>
        )}
      </Pressable>
      <Text style={[storyText.rowMeta, styles.nextWeek]}>
        {state === 'failed'
          ? 'Fikk ikke delt akkurat nå. Prøv igjen.'
          : `Ny uke starter ${formatNextWeekStart(data.weekEnd)}`}
      </Text>
    </Reveal>
  );
}

function RecapBars({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const best = days.reduce((bestIndex, day, index, all) =>
    day.count > all[bestIndex].count ? index : bestIndex, 0);

  return (
    <View style={styles.chart}>
      {days.map((day, index) => (
        <View key={`${day.day}-${index}`} style={styles.chartColumn}>
          <View style={styles.chartTrack}>
            <RecapBar
              height={Math.max(5, (day.count / max) * CHART_HEIGHT)}
              order={6 + index * 0.25}
              highlighted={index === best && day.count > 0}
            />
          </View>
          <Text style={styles.chartLabel}>{DAY_INITIALS[index]}</Text>
        </View>
      ))}
    </View>
  );
}

function RecapBar({
  height,
  order,
  highlighted,
}: {
  height: number;
  order: number;
  highlighted: boolean;
}) {
  const stage = useStage();
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: revealAt(stage.value, order) }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { height, backgroundColor: highlighted ? Ink.primary : Ink.track },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.two,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chartCard: {
    marginTop: Spacing.two - 4,
    gap: Spacing.two,
    borderRadius: Radii.card,
    backgroundColor: Ink.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  chartTrack: {
    width: '100%',
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 5,
    transformOrigin: 'bottom',
  },
  chartLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Ink.faint,
  },
  caption: {
    color: Ink.muted,
  },
  footer: {
    gap: Spacing.two,
  },
  shareButton: {
    height: 52,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Ink.primary,
  },
  sharePressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  shareLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  shareText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: PaneSkins.recap.gradient[0],
  },
  nextWeek: {
    textAlign: 'center',
    color: Ink.muted,
  },
});
