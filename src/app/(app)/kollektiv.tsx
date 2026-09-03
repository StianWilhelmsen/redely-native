import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR, { useSWRConfig } from 'swr';

import { ErrorState } from '@/components/error-state';
import { HighlightQuote } from '@/components/highlight-quote';
import { CollectiveHeader } from '@/components/kollektiv/collective-header';
import { SharedGoal } from '@/components/kollektiv/shared-goal';
import { WeekLeaderboard } from '@/components/kollektiv/week-leaderboard';
import { WeekPlan } from '@/components/kollektiv/week-plan';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';
import { isoWeekNumber, quickActionFlavor } from '@/lib/weekly-summary-copy';

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
      <ScreenScroll title="Kollektiv">
        <ErrorState message="Klarte ikke å hente profilen din." onRetry={() => mutateMe()} />
      </ScreenScroll>
    );
  }

  if (meLoading || !me?.collective) {
    return (
      <ScreenScroll title="Kollektiv">
        <RefreshSpinner active />
      </ScreenScroll>
    );
  }

  const topHighlight = weeklyStats?.quickActionsByUser[0];
  const highlight =
    topHighlight && weeklyStats ? quickActionFlavor(topHighlight, weeklyStats.weekStart) : null;

  let daysLeftInWeek = 0;
  if (weeklyStats) {
    const weekEndDate = parseDueDateLocal(weeklyStats.weekEnd)!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysLeftInWeek = Math.max(0, Math.round((weekEndDate.getTime() - today.getTime()) / 86_400_000));
  }

  const weekStart = weeklyStats
    ? parseDueDateLocal(weeklyStats.weekStart)!
    : startOfWeekMonday(new Date());

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={handleRefresh}>
      {statsError ? (
        <ErrorState message="Klarte ikke å hente statistikk." onRetry={() => mutate()} />
      ) : !weeklyStats ? (
        <RefreshSpinner active />
      ) : (
        <>
          <CollectiveHeader
            name={me.collective.name}
            pictureUrl={me.collective.pictureUrl}
            memberCount={weeklyStats.leaderboard.length}
            weekNumber={isoWeekNumber(weeklyStats.weekStart)}
          />

          <View style={[styles.rule, { backgroundColor: theme.border }]} />

          <SharedGoal stats={weeklyStats} daysLeft={daysLeftInWeek} />

          <View style={[styles.rule, { backgroundColor: theme.border }]} />

          <View style={styles.stats}>
            <Stat value={String(weeklyStats.totalPoints)} label="poeng denne uka" accent />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <Stat
              value={String(weeklyStats.plannedTasksCompleted)}
              suffix={`av ${weeklyStats.plannedTasks}`}
              label="faste oppgaver"
            />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <Stat value={String(weeklyStats.quickActions)} label="småjobber" />
          </View>

          <View style={[styles.rule, { backgroundColor: theme.border }]} />

          <Section title="Toppliste" meta="denne uka">
            <WeekLeaderboard
              leaderboard={weeklyStats.leaderboard}
              tasks={weeklyStats.tasks}
              quickActionsByUser={weeklyStats.quickActionsByUser}
              meId={me.id}
            />
          </Section>

          <Section
            title="Denne uka"
            meta={
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/weeks')}
                hitSlop={Spacing.two}>
                <ThemedText type="smallBold" themeColor="brand">
                  Neste uke ›
                </ThemedText>
              </Pressable>
            }>
            <WeekPlan weekStart={weekStart} tasks={tasks ?? []} />
          </Section>

          {highlight && topHighlight && (
            <HighlightQuote text={highlight} caption={`Ukens høydepunkt · ${topHighlight.name}`} />
          )}

          {/* Secondary entry point — the main one is Hjem's ukemål bar, which is the first
              thing anyone sees and already shows this week's live number. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se ukesoppsummeringen"
            onPress={() => router.push('/weekly-summary')}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.summaryLink, pressed && styles.pressed]}>
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

function Stat({
  value,
  suffix,
  label,
  accent,
}: {
  value: string;
  suffix?: string;
  label: string;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <ThemedText style={[styles.statValue, { color: accent ? theme.brand : theme.text }]}>
          {value}
        </ThemedText>
        {suffix && (
          <ThemedText type="small" themeColor="textSecondary">
            {suffix}
          </ThemedText>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  stat: {
    flex: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  summaryLink: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
