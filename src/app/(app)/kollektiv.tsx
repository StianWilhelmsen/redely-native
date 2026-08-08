import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR, { useSWRConfig } from 'swr';

import { AnimatedNumber } from '@/components/animated-number';
import { AvatarBadge } from '@/components/avatar-badge';
import { BarChart } from '@/components/bar-chart';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { addDays, formatShortDate, localDateKey, parseDueDateLocal, startOfWeekMonday, weekdayLabel } from '@/lib/date-utils';
import type { Task } from '@/types/api';

function formatKr(amount: number): string {
  return `${Math.round(amount)} kr`;
}

export default function KollektivScreen() {
  const theme = useTheme();
  const { data: me, error: meError, isLoading: meLoading, mutate: mutateMe } = useMe();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: stats, error: statsError, mutate } = useSWR(
    me?.collective ? 'collective-stats' : null,
    api.collectiveStats
  );
  const { data: tasks } = useSWR(me?.collective ? 'tasks' : null, api.tasks);
  const memberCount = members?.length ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([mutate(), globalMutate('members'), globalMutate('tasks')]);
    setRefreshing(false);
  };

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addDays(startOfWeekMonday(new Date()), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekLabel =
    weekOffset === 0 ? 'Denne uken' : weekOffset === 1 ? 'Neste uke' : weekOffset === -1 ? 'Forrige uke' : null;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const tasksByDay = new Map<string, Task[]>();
  for (const task of tasks ?? []) {
    const d = parseDueDateLocal(task.dueDate);
    if (!d || d < weekStart || d > weekEnd) continue;
    const key = localDateKey(d);
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key)!.push(task);
  }

  const settingsButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Kollektivinnstillinger"
      onPress={() => router.push('/collective-settings')}
      hitSlop={Spacing.two}
      style={[styles.settingsButton, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="settings-outline" size={20} color={theme.text} />
    </Pressable>
  );

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

  return (
    <ScreenScroll
      eyebrow={`${me.collective.name} · ${memberCount} medlem${memberCount === 1 ? '' : 'mer'}`}
      title="Kollektiv"
      headerRight={settingsButton}
      refreshing={refreshing}
      onRefresh={handleRefresh}>
      {statsError ? (
        <ErrorState message="Klarte ikke å hente statistikk." onRetry={() => mutate()} />
      ) : !stats ? (
        <RefreshSpinner active />
      ) : (
        <>
          <View style={[styles.streakCard, { backgroundColor: theme.brand }]}>
            <ThemedText type="eyebrow" themeColor="onBrand" style={styles.streakLabel}>
              Kollektivets streak
            </ThemedText>
            <AnimatedNumber
              value={stats.streakDays}
              formatter={(n) => `${n} dager`}
              type="display"
              themeColor="onBrand"
            />
            <ThemedText type="small" themeColor="onBrand" style={styles.streakCaption}>
              på rad uten glemte oppgaver
            </ThemedText>
          </View>

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

          <View style={styles.statRow}>
            <View style={[styles.statTile, { backgroundColor: `${theme.success}22` }]}>
              <AnimatedNumber value={stats.completedThisMonth} type="heading" style={{ color: theme.success }} />
              <ThemedText type="small" themeColor="textSecondary">
                oppgaver denne mnd.
              </ThemedText>
            </View>
            <View style={[styles.statTile, { backgroundColor: `${theme.brand}1C` }]}>
              <AnimatedNumber
                value={stats.moneySharedThisMonth}
                formatter={formatKr}
                type="heading"
                style={{ color: theme.brand }}
              />
              <ThemedText type="small" themeColor="textSecondary">
                delt i utgifter
              </ThemedText>
            </View>
            <View
              style={[
                styles.statTile,
                { backgroundColor: stats.overdueCount > 0 ? `${theme.danger}1C` : `${theme.success}22` },
              ]}>
              <AnimatedNumber
                value={stats.overdueCount}
                type="heading"
                style={{ color: stats.overdueCount > 0 ? theme.danger : theme.success }}
              />
              <ThemedText type="small" themeColor="textSecondary">
                glemte oppgaver
              </ThemedText>
            </View>
          </View>

          <Section title="Oppgaver denne uken">
            <BarChart data={stats.weeklyCompletions} />
          </Section>

          <Section title="Toppliste — fullførte oppgaver">
            <View style={styles.leaderboard}>
              {stats.leaderboard.map((entry, index) => (
                <View key={entry.userId} style={styles.leaderboardRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
                    {index + 1}
                  </ThemedText>
                  <AvatarBadge userId={entry.userId} name={entry.name} pictureUrl={entry.pictureUrl} size={32} />
                  <View style={styles.leaderboardInfo}>
                    <View style={styles.leaderboardNameRow}>
                      <ThemedText type="smallBold" numberOfLines={1} style={styles.leaderboardName}>
                        {entry.name}
                      </ThemedText>
                      {entry.mvp && (
                        <View style={[styles.mvpBadge, { backgroundColor: `${theme.brandSecondary}33` }]}>
                          <ThemedText type="small" style={{ color: theme.brandSecondary }}>
                            MVP
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${entry.completionPercent}%`, backgroundColor: theme.brand },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.leaderboardCount}>
                    <ThemedText type="smallBold">{entry.completed}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      av {entry.assigned}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Ukeplan">
            <View style={styles.weekNav}>
              <Pressable
                onPress={() => setWeekOffset((w) => w - 1)}
                hitSlop={Spacing.two}
                style={[styles.weekNavButton, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => setWeekOffset(0)} style={styles.weekNavLabel} disabled={weekOffset === 0}>
                <ThemedText type="smallBold">{weekLabel ?? `Uke ${weekOffset > 0 ? '+' : ''}${weekOffset}`}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setWeekOffset((w) => w + 1)}
                hitSlop={Spacing.two}
                style={[styles.weekNavButton, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="chevron-forward" size={18} color={theme.text} />
              </Pressable>
            </View>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              {weekDays.map((day, index) => {
                const key = localDateKey(day);
                const dayTasks = tasksByDay.get(key) ?? [];
                const isToday = key === localDateKey(new Date());
                return (
                  <Fragment key={key}>
                    {index > 0 && <Separator />}
                    <View style={styles.dayRow}>
                      <View style={styles.dayLabelCol}>
                        <ThemedText type="small" themeColor={isToday ? 'brand' : 'textSecondary'}>
                          {weekdayLabel(day).slice(0, 3)}
                        </ThemedText>
                        <ThemedText type="smallBold" themeColor={isToday ? 'brand' : 'text'}>
                          {day.getDate()}
                        </ThemedText>
                      </View>
                      <View style={styles.dayTasks}>
                        {dayTasks.length === 0 ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            Ingen oppgaver
                          </ThemedText>
                        ) : (
                          dayTasks.map((task) => (
                            <Pressable
                              key={task.id}
                              onPress={() => router.push({ pathname: '/tasks/new', params: { id: String(task.id) } })}
                              style={styles.dayTaskRow}>
                              {task.assignedTo && (
                                <AvatarBadge
                                  userId={task.assignedTo.id}
                                  name={task.assignedTo.name}
                                  pictureUrl={task.assignedTo.pictureUrl}
                                  shape="circle"
                                  size={22}
                                />
                              )}
                              <ThemedText
                                type="small"
                                numberOfLines={1}
                                themeColor={task.completed ? 'textSecondary' : 'text'}
                                style={[styles.dayTaskTitle, task.completed && styles.strikethrough]}>
                                {task.title}
                              </ThemedText>
                              <ThemedText type="small" themeColor="textSecondary">
                                ›
                              </ThemedText>
                            </Pressable>
                          ))
                        )}
                      </View>
                    </View>
                  </Fragment>
                );
              })}
            </View>
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
  },
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
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavLabel: {
    alignItems: 'center',
    gap: 1,
  },
  dayRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  dayLabelCol: {
    width: 36,
    alignItems: 'center',
  },
  dayTasks: {
    flex: 1,
    gap: Spacing.one + 2,
    justifyContent: 'center',
  },
  dayTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayTaskTitle: {
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  streakCard: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  streakLabel: {
    opacity: 0.85,
  },
  streakCaption: {
    opacity: 0.85,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statTile: {
    flex: 1,
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: 2,
  },
  leaderboard: {
    gap: Spacing.three,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rank: {
    width: 16,
  },
  leaderboardInfo: {
    flex: 1,
    gap: 4,
  },
  leaderboardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  leaderboardName: {
    flexShrink: 1,
  },
  leaderboardCount: {
    alignItems: 'flex-end',
  },
  mvpBadge: {
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
