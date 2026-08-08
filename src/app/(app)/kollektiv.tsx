import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR, { useSWRConfig } from 'swr';

import { CollectiveOverview } from '@/components/kollektiv/collective-overview';
import { NextWeekPreview, SeeAllWeeksLink } from '@/components/kollektiv/next-week-preview';
import { WeekActivityBars } from '@/components/kollektiv/week-activity-bars';
import { WeekLeaderboard } from '@/components/kollektiv/week-leaderboard';
import { ErrorState } from '@/components/error-state';
import { HighlightQuote } from '@/components/highlight-quote';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';
import { addDays, parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';
import { isoWeekNumber, quickActionFlavor, topDayShortCaption } from '@/lib/weekly-summary-copy';

export default function KollektivScreen() {
  const theme = useTheme();
  const { data: me, error: meError, isLoading: meLoading, mutate: mutateMe } = useMe();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: weeklyStats, error: statsError, mutate } = useSWR(
    me?.collective ? 'weekly-stats' : null,
    api.weeklyStats
  );
  const { data: tasks } = useSWR(me?.collective ? 'tasks' : null, api.tasks);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([mutate(), globalMutate('tasks')]);
    setRefreshing(false);
  };

  if (meError) {
    return (
      <ScreenScroll eyebrow="Kollektiv" title="Kollektiv">
        <ErrorState message="Klarte ikke å hente profilen din." onRetry={() => mutateMe()} />
      </ScreenScroll>
    );
  }

  if (meLoading) {
    return (
      <ScreenScroll eyebrow="Kollektiv" title="Kollektiv">
        <RefreshSpinner active />
      </ScreenScroll>
    );
  }

  if (!me?.collective) {
    return (
      <ScreenScroll eyebrow="Kollektiv" title="Kollektiv">
        <ThemedText type="small" themeColor="textSecondary">
          Du er ikke med i et kollektiv ennå. Gå til Hjem for å opprette eller bli med i et.
        </ThemedText>
      </ScreenScroll>
    );
  }

  const nextWeekStart = weeklyStats
    ? addDays(parseDueDateLocal(weeklyStats.weekStart)!, 7)
    : addDays(startOfWeekMonday(new Date()), 7);

  const topHighlight = weeklyStats?.quickActionsByUser[0];
  const highlight = topHighlight && weeklyStats ? quickActionFlavor(topHighlight, weeklyStats.weekStart) : null;

  let daysLeftInWeek = 0;
  if (weeklyStats) {
    const weekEndDate = parseDueDateLocal(weeklyStats.weekEnd)!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysLeftInWeek = Math.max(0, Math.round((weekEndDate.getTime() - today.getTime()) / 86_400_000));
  }

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={handleRefresh}>
      {statsError ? (
        <ErrorState message="Klarte ikke å hente statistikk." onRetry={() => mutate()} />
      ) : !weeklyStats ? (
        <RefreshSpinner active />
      ) : (
        <>
          <CollectiveOverview
            collectiveName={me.collective.name}
            collectivePictureUrl={me.collective.pictureUrl}
            memberCount={weeklyStats.leaderboard.length}
            weekNumber={isoWeekNumber(weeklyStats.weekStart)}
            onSettingsPress={() => router.push('/collective-settings')}
            goalStreakWeeks={weeklyStats.goalStreakWeeks}
            totalPoints={weeklyStats.totalPoints}
            goalPoints={weeklyStats.goalPoints}
            daysLeftInWeek={daysLeftInWeek}
            plannedTasksCompleted={weeklyStats.plannedTasksCompleted}
            plannedTasks={weeklyStats.plannedTasks}
            quickActions={weeklyStats.quickActions}
          />

          <Section title="Aktivitet denne uka" meta={topDayShortCaption(weeklyStats) ?? undefined}>
            <WeekActivityBars data={weeklyStats.dayCounts} />
          </Section>

          <Section title="Toppliste" meta="denne uka">
            <WeekLeaderboard
              leaderboard={weeklyStats.leaderboard}
              quickActionsByUser={weeklyStats.quickActionsByUser}
            />
          </Section>

          <Section title="Neste uke" meta={<SeeAllWeeksLink />}>
            <NextWeekPreview nextWeekStart={nextWeekStart} tasks={tasks ?? []} />
          </Section>

          {highlight && topHighlight && (
            <HighlightQuote text={highlight} caption={`Ukens høydepunkt · ${topHighlight.name}`} />
          )}

          {/* Secondary entry point — the main one lives on Hjem's ukemål-kort, which is
              the first thing anyone sees and already shows this week's live number. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se ukesoppsummeringen"
            onPress={() => router.push('/weekly-summary')}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.summaryLink, pressed && styles.summaryLinkPressed]}>
            <ThemedText type="small" themeColor="textSecondary">
              Se ukesoppsummeringen
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
          </Pressable>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  summaryLink: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.one,
  },
  summaryLinkPressed: {
    opacity: 0.6,
  },
});
