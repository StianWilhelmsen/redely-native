import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { ConfettiBurst } from '@/components/celebration/confetti-burst';
import { PaneCover } from '@/components/weekly-summary/pane-cover';
import { PaneGoal } from '@/components/weekly-summary/pane-goal';
import { PaneLeaderboard } from '@/components/weekly-summary/pane-leaderboard';
import { PaneMvp } from '@/components/weekly-summary/pane-mvp';
import { PaneQuickActions } from '@/components/weekly-summary/pane-quick-actions';
import { PaneRecap, RecapFooter, type ShareState } from '@/components/weekly-summary/pane-recap';
import { PaneTasks } from '@/components/weekly-summary/pane-tasks';
import { StoryPager, type StoryPaneDefinition } from '@/components/weekly-summary/story-pager';
import { Ink, PaneSkins, StoryConfetti } from '@/components/weekly-summary/story-theme';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';
import { isoWeekNumber, shareMessage } from '@/lib/weekly-summary-copy';
import {
  currentOsloWeekStart,
  markWeeklySummarySeen,
  sundaySummaryWeek,
} from '@/lib/weekly-summary';
import type { WeeklyStats } from '@/types/api';

export default function WeeklySummaryScreen() {
  const { data: me } = useMe();
  const params = useLocalSearchParams<{ weekStart?: string | string[] }>();
  const requestedWeek = Array.isArray(params.weekStart) ? params.weekStart[0] : params.weekStart;
  const weekStart =
    requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
      ? requestedWeek
      : currentOsloWeekStart();

  const { data: raw, error, isLoading, mutate } = useSWR(['weekly-summary', weekStart], () =>
    api.weeklyStatsForWeek(weekStart)
  );

  // The story pulls apart fields an older backend doesn't send yet. Filling them in means an
  // app that gets ahead of a deploy shows a thinner week rather than a crash.
  const data = useMemo<WeeklyStats | undefined>(
    () =>
      raw && {
        ...raw,
        previousWeekPoints: raw.previousWeekPoints ?? 0,
        plannedTasks: raw.plannedTasks ?? 0,
        plannedTasksCompleted: raw.plannedTasksCompleted ?? 0,
        mvpStreakWeeks: raw.mvpStreakWeeks ?? 0,
        tasks: raw.tasks ?? [],
        quickActionsByUser: raw.quickActionsByUser ?? [],
        dayCounts: raw.dayCounts ?? [],
        leaderboard: raw.leaderboard ?? [],
      },
    [raw]
  );

  const isFinished = weekStart !== currentOsloWeekStart() || sundaySummaryWeek() === weekStart;

  useEffect(() => {
    if (!me?.id || !isFinished) return;
    markWeeklySummarySeen(me.id, weekStart).catch(() => {});
  }, [isFinished, me?.id, weekStart]);

  const [shareState, setShareState] = useState<ShareState>('idle');
  const [celebration, setCelebration] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const share = useCallback(async () => {
    if (!data) return;
    setShareState('sending');
    try {
      await api.sendChatMessage(shareMessage(data));
      setShareState('sent');
      setCelebration(`share-${Date.now()}`);
    } catch {
      setShareState('failed');
    }
  }, [data]);

  const panes = useMemo<StoryPaneDefinition[]>(() => {
    if (!data) return [];

    const list: StoryPaneDefinition[] = [
      {
        key: 'cover',
        skin: PaneSkins.cover,
        content: <PaneCover data={data} isFinished={isFinished} />,
      },
      { key: 'goal', skin: PaneSkins.goal, content: <PaneGoal data={data} /> },
      { key: 'tasks', skin: PaneSkins.tasks, content: <PaneTasks data={data} /> },
      {
        key: 'quick-actions',
        skin: PaneSkins.quickActions,
        content: <PaneQuickActions data={data} />,
      },
    ];

    if (data.mvp) {
      list.push({ key: 'mvp', skin: PaneSkins.mvp, content: <PaneMvp data={data} mvp={data.mvp} /> });
    }

    list.push(
      { key: 'leaderboard', skin: PaneSkins.leaderboard, content: <PaneLeaderboard data={data} /> },
      {
        key: 'recap',
        skin: PaneSkins.recap,
        content: <PaneRecap data={data} />,
        footer: <RecapFooter data={data} state={shareState} onShare={share} />,
      }
    );

    return list;
  }, [data, isFinished, share, shareState]);

  // Confetti fires on the two panes worth celebrating: the goal pane once its ring has
  // swept all the way round, and the recap at the end of the run. The delay is what makes
  // it read as a reaction to the number landing rather than to the swipe.
  const activeKey = panes[activeIndex]?.key;
  const goalReached = data?.goalReached ?? false;
  const scoredAnything = (data?.totalPoints ?? 0) > 0;

  useEffect(() => {
    const worthCelebrating =
      (activeKey === 'goal' && goalReached) || (activeKey === 'recap' && scoredAnything);
    if (!worthCelebrating) return;

    const timer = setTimeout(() => setCelebration(`${activeKey}-${Date.now()}`), 750);
    return () => clearTimeout(timer);
  }, [activeKey, goalReached, scoredAnything]);

  if (error) {
    return (
      <StoryFallback>
        <Text style={styles.fallbackText}>Klarte ikke å hente ukesoppsummeringen.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => mutate()}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
          <Text style={styles.retryText}>Prøv igjen</Text>
        </Pressable>
      </StoryFallback>
    );
  }

  if (isLoading || !data) {
    return (
      <StoryFallback>
        <ActivityIndicator color={Ink.primary} />
      </StoryFallback>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <StoryPager
        panes={panes}
        onIndexChange={setActiveIndex}
        header={<StoryHeader data={data} />}
      />
      {celebration && (
        <View style={styles.confetti} pointerEvents="none">
          {/* Keyed, not just passed a new burstKey: the particles animate from their own
              mount effect, so a replay needs a fresh mount. */}
          <ConfettiBurst key={celebration} burstKey={celebration} colors={StoryConfetti} />
        </View>
      )}
    </View>
  );
}

function StoryHeader({ data }: { data: WeeklyStats }) {
  return (
    <View style={styles.header} pointerEvents="box-none">
      <View style={styles.weekLabel}>
        <Ionicons name="time-outline" size={13} color={Ink.secondary} />
        <Text style={styles.weekText} numberOfLines={1}>
          {`Uke ${isoWeekNumber(data.weekStart)}${data.collectiveName ? ` · ${data.collectiveName}` : ''}`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lukk ukesoppsummeringen"
        onPress={() => router.back()}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
        <Ionicons name="close" size={19} color={Ink.primary} />
      </Pressable>
    </View>
  );
}

function StoryFallback({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.fallback]}>
      <StatusBar style="light" />
      {children}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lukk ukesoppsummeringen"
        onPress={() => router.back()}
        style={[styles.fallbackClose, { top: insets.top + Spacing.three }]}>
        <Ionicons name="close" size={19} color={Ink.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaneSkins.recap.gradient[0],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three - 2,
  },
  weekLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  weekText: {
    flexShrink: 1,
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Ink.secondary,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Ink.surfaceStrong,
  },
  closePressed: {
    opacity: 0.7,
  },
  confetti: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  fallbackText: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    textAlign: 'center',
    color: Ink.secondary,
  },
  fallbackClose: {
    position: 'absolute',
    right: Spacing.four,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Ink.surfaceStrong,
  },
  retry: {
    borderRadius: Radii.pill,
    backgroundColor: Ink.surfaceStrong,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  retryPressed: {
    opacity: 0.8,
  },
  retryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Ink.primary,
  },
});
