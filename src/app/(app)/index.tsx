import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { CelebrationOverlay } from '@/components/celebration/celebration-overlay';
import { useCelebration } from '@/components/celebration/use-celebration';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { ErrorState } from '@/components/error-state';
import { CollectiveToday } from '@/components/home/collective-today';
import { MyTaskList } from '@/components/home/my-task-list';
import { QuickActionsSection } from '@/components/home/quick-actions-section';
import { TodayStats } from '@/components/home/today-stats';
import { WeeklyGoalBar } from '@/components/home/weekly-goal-bar';
import { NotificationPrompt } from '@/components/notification-prompt';
import { PillSegmentedControl } from '@/components/pill-segmented-control';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { PaywallSheet } from '@/components/subscription/paywall-sheet';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Control, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { addDays, localDateKey, parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';
import type { Task } from '@/types/api';

type ViewMode = 'today' | 'week';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, error: meError, isLoading: meLoading, mutate: mutateMe } = useMe();
  const { mutate: globalMutate } = useSWRConfig();
  const notifyPlayer = useAudioPlayer(require('@/assets/notifysfx.mp3'));

  const hasCollective = !!me?.collective;

  const { data: tasks, error: tasksError, isLoading: tasksLoading, mutate: mutateTasks } = useSWR(
    hasCollective ? 'tasks' : null,
    api.tasks
  );
  const { data: activity } = useSWR(hasCollective ? 'activity' : null, api.activity);
  const { data: weeklyStats } = useSWR(hasCollective ? 'weekly-stats' : null, api.weeklyStats);
  const { data: quickActions, mutate: mutateQuickActions } = useSWR(
    hasCollective ? 'quick-actions' : null,
    api.quickActions
  );
  const { data: members } = useSWR(hasCollective ? 'members' : null, api.members);
  // Every write in the app 402s while the subscription is lapsed - without this banner
  // that surfaced only as buttons silently doing nothing, which reads as the app being
  // broken rather than the subscription needing attention.
  const { data: billing } = useSWR(hasCollective ? 'billing-status' : null, api.billingStatus);

  const [mode, setMode] = useState<ViewMode>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { message, burstKey, celebrate, dismiss } = useCelebration();

  const today = new Date();
  const weekStart = startOfWeekMonday(today);
  const weekEnd = addDays(weekStart, 6);
  const todayKey = localDateKey(today);

  const isInThisWeek = (t: Task) => {
    const d = parseDueDateLocal(t.dueDate);
    return !!d && d >= weekStart && d <= weekEnd;
  };
  const isDueToday = (t: Task) => {
    const d = parseDueDateLocal(t.dueDate);
    return !!d && localDateKey(d) === todayKey;
  };
  const isMine = (t: Task) => t.assignedTo?.id === me?.id;

  const allTasks = tasks ?? [];
  const collectiveWeekTasks = allTasks.filter(isInThisWeek);
  const myWeekTasks = collectiveWeekTasks.filter(isMine);
  const myTodayTasks = allTasks.filter((t) => isDueToday(t) && isMine(t));
  const myTodayOpenCount = myTodayTasks.filter((t) => !t.completed).length;

  const showingToday = mode === 'today';
  const myVisibleTasks = showingToday ? myTodayTasks : myWeekTasks;

  const prevGoalReached = useRef<boolean | null>(null);
  const prevTodayOpenCount = useRef<number | null>(null);

  useEffect(() => {
    if (!weeklyStats || weeklyStats.goalPoints <= 0) return;
    const reached = weeklyStats.totalPoints >= weeklyStats.goalPoints;
    if (reached && prevGoalReached.current === false) {
      celebrate('Ukemål nådd! 🎉');
    }
    prevGoalReached.current = reached;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyStats?.totalPoints, weeklyStats?.goalPoints]);

  useEffect(() => {
    if (!tasks || myTodayTasks.length === 0) return;
    if (myTodayOpenCount === 0 && (prevTodayOpenCount.current ?? 0) > 0) {
      celebrate('Alt gjort for i dag! 💪');
    }
    prevTodayOpenCount.current = myTodayOpenCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTodayOpenCount, tasks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      mutateMe(),
      mutateTasks(),
      globalMutate('activity'),
      globalMutate('weekly-stats'),
      globalMutate('members'),
      mutateQuickActions(),
    ]);
    setRefreshing(false);
  };

  const handleToggleTask = async (task: Task) => {
    if (task.assignedTo && task.assignedTo.id !== me?.id) {
      Alert.alert('Ikke din oppgave', 'Du kan bare markere dine egne oppgaver som gjort.');
      return;
    }
    const next = !task.completed;

    if (next) {
      notifyPlayer.seekTo(0);
      notifyPlayer.play();
    }

    try {
      await mutateTasks(
        async (current) => {
          const updated = await api.setTaskCompleted(task.id, next);
          return (current ?? []).map((t) => (t.id === task.id ? updated : t));
        },
        {
          optimisticData: (current) =>
            (current ?? []).map((t) => (t.id === task.id ? { ...t, completed: next } : t)),
          rollbackOnError: true,
          revalidate: false,
        }
      );
      globalMutate('activity');
      globalMutate('weekly-stats');
      if (next) celebrate('Godt jobba! 🎉');
    } catch (err) {
      // rollbackOnError restored the list - but the failure itself must be said out loud.
      // Swallowing it made a lapsed subscription's 402 look like the checkbox being broken.
      Alert.alert('Kunne ikke lagre', err instanceof Error ? err.message : 'Prøv igjen senere.');
    }
  };

  const handleQuickAction = async (key: string) => {
    try {
      await mutateQuickActions(
        async (current) => {
          const updated = await api.completeQuickAction(key);
          return (current ?? []).map((a) => (a.key === key ? updated : a));
        },
        {
          optimisticData: (current) =>
            (current ?? []).map((a) =>
              a.key === key
                ? { ...a, countThisWeek: a.countThisWeek + 1, countAllTime: a.countAllTime + 1 }
                : a
            ),
          rollbackOnError: true,
          revalidate: false,
        }
      );
      globalMutate('activity');
      globalMutate('weekly-stats');
    } catch (err) {
      Alert.alert('Kunne ikke lagre', err instanceof Error ? err.message : 'Prøv igjen senere.');
    }
  };

  if (meError) {
    return (
      <ScreenScroll>
        <ErrorState message="Klarte ikke å hente profilen din." onRetry={() => mutateMe()} />
      </ScreenScroll>
    );
  }

  if (meLoading || !me) {
    return (
      <ScreenScroll>
        <RefreshSpinner active />
      </ScreenScroll>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenScroll
        eyebrow={me.collective?.name}
        title="Hjem"
        headerRight={<CollectiveAvatar pictureUrl={me.collective?.pictureUrl} size={44} />}
        headerExtra={
          <PillSegmentedControl
            options={[
              { key: 'today', label: 'I dag' },
              { key: 'week', label: 'Denne uken' },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}>
        {billing?.readOnly && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abonnementet er utløpt, velg plan"
            onPress={() => setPaywallVisible(true)}
            style={({ pressed }) => [
              styles.subscriptionBanner,
              { backgroundColor: `${theme.danger}14`, borderColor: `${theme.danger}45` },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="lock-closed" size={20} color={theme.danger} />
            <View style={styles.subscriptionBannerText}>
              <ThemedText type="smallBold">Abonnementet er utløpt</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Dere kan se alt, men ikke gjøre endringer før kollektivet har en aktiv plan.
              </ThemedText>
            </View>
            <ThemedText type="smallBold" themeColor="brand">
              Velg plan
            </ThemedText>
          </Pressable>
        )}

        {tasksError ? (
          <ErrorState message="Klarte ikke å hente oppgaver." onRetry={() => mutateTasks()} />
        ) : tasksLoading ? (
          <RefreshSpinner active />
        ) : (
          <>
            <TodayStats
              stats={[
                { label: 'I dag', value: myTodayOpenCount, caption: 'for deg', emphasize: true },
                {
                  label: 'Mine',
                  value: myWeekTasks.filter((t) => !t.completed).length,
                  caption: `av ${myWeekTasks.length} i uka`,
                },
                {
                  label: 'Felles',
                  value: collectiveWeekTasks.filter((t) => !t.completed).length,
                  caption: `av ${collectiveWeekTasks.length} i uka`,
                },
              ]}
            />

            {weeklyStats && <WeeklyGoalBar stats={weeklyStats} />}

            <Section
              title={showingToday ? 'Dine oppgaver i dag' : 'Dine oppgaver denne uken'}
              variant="eyebrow">
              <MyTaskList
                tasks={myVisibleTasks}
                onToggle={handleToggleTask}
                onOpen={(task) =>
                  router.push({ pathname: '/tasks/new', params: { id: String(task.id) } })
                }
                emptyText={
                  showingToday
                    ? 'Ingen oppgaver igjen i dag. 🎉'
                    : 'Ingen oppgaver igjen denne uka. 🎉'
                }
              />
            </Section>

            {members && members.length > 1 && (
              <Section
                title="Resten av kollektivet"
                meta={showingToday ? 'i dag' : 'denne uken'}
                variant="eyebrow">
                <CollectiveToday
                  members={members}
                  tasks={allTasks}
                  activity={activity}
                  meId={me.id}
                  periodEnd={showingToday ? today : weekEnd}
                  periodLabel={showingToday ? 'i dag' : 'denne uken'}
                />
              </Section>
            )}

            {quickActions && quickActions.length > 0 && (
              <QuickActionsSection actions={quickActions} onComplete={handleQuickAction} />
            )}
          </>
        )}
      </ScreenScroll>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ny oppgave"
        onPress={() => router.push('/tasks/new')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.brand,
            bottom: Math.max(insets.bottom, Spacing.three) + BottomTabInset - Spacing.two - 60,
          },
          pressed && styles.fabPressed,
        ]}>
        <Ionicons name="add" size={30} color={theme.onBrand} />
      </Pressable>

      <CelebrationOverlay message={message} burstKey={burstKey} onDismiss={dismiss} />
      <NotificationPrompt />
      <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Control.radius,
    padding: Spacing.three,
  },
  subscriptionBannerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 6px 20px rgba(0,0,0,0.2)' } : null),
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  pressed: {
    opacity: 0.8,
  },
});
