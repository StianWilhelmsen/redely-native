import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import {
  currentOsloWeekStart,
  markWeeklySummarySeen,
  sundaySummaryWeek,
} from '@/lib/weekly-summary';

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const startLabel = start.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  const endLabel = end.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  return `${startLabel} – ${endLabel}`;
}

export default function WeeklySummaryScreen() {
  const theme = useTheme();
  const { data: me } = useMe();
  const params = useLocalSearchParams<{ weekStart?: string | string[] }>();
  const requestedWeek = Array.isArray(params.weekStart) ? params.weekStart[0] : params.weekStart;
  const weekStart = requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
    ? requestedWeek
    : currentOsloWeekStart();

  const { data, error, isLoading, mutate } = useSWR(
    ['weekly-summary', weekStart],
    () => api.weeklyStatsForWeek(weekStart)
  );

  const isFinished = weekStart !== currentOsloWeekStart() || sundaySummaryWeek() === weekStart;

  useEffect(() => {
    if (!me?.id || !isFinished) return;
    markWeeklySummarySeen(me.id, weekStart).catch(() => {});
  }, [isFinished, me?.id, weekStart]);

  const title = isFinished ? 'Ukesoppsummering' : 'Uken så langt';
  const progress = data?.goalPoints
    ? Math.min(100, Math.round((data.totalPoints / data.goalPoints) * 100))
    : 0;

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lukk ukesoppsummeringen"
      onPress={() => router.back()}
      hitSlop={Spacing.two}
      style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="close" size={22} color={theme.text} />
    </Pressable>
  );

  return (
    <ScreenScroll
      eyebrow={data ? formatWeekRange(data.weekStart, data.weekEnd) : 'Mandag – søndag'}
      title={title}
      headerRight={closeButton}>
      {error ? (
        <ErrorState message="Klarte ikke å hente ukesoppsummeringen." onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <RefreshSpinner active />
      ) : (
        <>
          <Section title="Felles ukesmål" meta={data.goalReached ? 'Målet er nådd' : undefined}>
            <View style={styles.goalHeader}>
              <ThemedText type="subtitle">{data.totalPoints}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                av {data.goalPoints} poeng
              </ThemedText>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: data.goalPoints, now: data.totalPoints }}
              style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor: data.goalReached ? theme.success : theme.brand,
                  },
                ]}
              />
            </View>
            <View style={styles.factRow}>
              <View style={styles.fact}>
                <ThemedText type="heading">{data.completedTasks}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  fullførte oppgaver
                </ThemedText>
              </View>
              <View style={[styles.factDivider, { backgroundColor: theme.border }]} />
              <View style={styles.fact}>
                <ThemedText type="heading">{data.quickActions}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  småoppgaver
                </ThemedText>
              </View>
            </View>
          </Section>

          {data.mvp && (
            <Section title={isFinished ? 'Ukens MVP' : 'MVP akkurat nå'}>
              <View style={[styles.mvpRow, { backgroundColor: theme.backgroundElement }]}>
                <AvatarBadge
                  userId={data.mvp.userId}
                  name={data.mvp.name}
                  pictureUrl={data.mvp.pictureUrl}
                  size={44}
                  shape="circle"
                />
                <View style={styles.memberText}>
                  <ThemedText type="heading" numberOfLines={1}>
                    {data.mvp.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {data.mvp.weekPoints} poeng denne uken
                  </ThemedText>
                </View>
                <View style={[styles.mvpBadge, { backgroundColor: `${theme.brandSecondary}2B` }]}>
                  <ThemedText type="smallBold" style={{ color: theme.brandSecondary }}>
                    MVP
                  </ThemedText>
                </View>
              </View>
            </Section>
          )}

          <Section title="Poengfordeling">
            <View style={[styles.ranking, { backgroundColor: theme.backgroundElement }]}>
              {data.leaderboard.map((member, index) => (
                <Fragment key={member.userId}>
                  {index > 0 && <Separator />}
                  <View style={styles.rankRow}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankNumber}>
                      {index + 1}
                    </ThemedText>
                    <AvatarBadge
                      userId={member.userId}
                      name={member.name}
                      pictureUrl={member.pictureUrl}
                      size={34}
                      shape="circle"
                    />
                    <View style={styles.memberText}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {member.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Nivå {member.level}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{member.weekPoints} p</ThemedText>
                  </View>
                </Fragment>
              ))}
            </View>
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: Spacing.two,
  },
  fact: {
    flex: 1,
    gap: 2,
  },
  factDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  mvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radii.card,
    padding: Spacing.three,
  },
  mvpBadge: {
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  ranking: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
  },
  rankRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rankNumber: {
    width: 18,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
  },
});
