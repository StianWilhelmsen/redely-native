import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import useSWR, { useSWRConfig } from 'swr';

import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { currentMonthLabel, MonthActivityHeatmap } from '@/components/me/month-activity-heatmap';
import { ProfileIdentity, ProfileOverview } from '@/components/me/profile-overview';
import { PrimaryButton } from '@/components/primary-button';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { TaskCard } from '@/components/tasks/task-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';
import { addDays, formatShortDate, parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';
import { quickActionFlavor } from '@/lib/weekly-summary-copy';
import type { Task } from '@/types/api';

export default function MeScreen() {
  const { data: me, error: meError, isLoading, mutate: mutateMe } = useMe();
  const { mutate: globalMutate } = useSWRConfig();
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: myStats, error: myStatsError, mutate: mutateMyStats } = useSWR(
    me?.collective ? 'my-stats' : null,
    api.myStats
  );
  // Shares the 'weekly-stats' cache key with Hjem, so it's usually already warm by the
  // time someone lands here - it supplies this week's småjobb count and the highlight quote.
  const { data: weeklyStats } = useSWR(me?.collective ? 'weekly-stats' : null, api.weeklyStats);
  const { data: tasks, mutate: mutateTasks } = useSWR(me?.collective ? 'tasks' : null, api.tasks);
  const { data: expenses } = useSWR(me?.collective ? 'expenses' : null, api.expenses);

  const handleToggleTask = async (task: Task) => {
    const next = !task.completed;
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
      // Completing a task moves points, streaks and the activity feed - refresh what's on screen.
      mutateMyStats();
      globalMutate('activity');
      globalMutate('weekly-stats');
    } catch {
      // rollbackOnError already restored the previous state.
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      mutateMe(),
      globalMutate('members'),
      mutateMyStats(),
      globalMutate('weekly-stats'),
      globalMutate('tasks'),
      globalMutate('expenses'),
    ]);
    setRefreshing(false);
  };

  if (meError && !me) {
    return (
      <ScreenScroll>
        <ErrorState message="Klarte ikke å hente profilen din." onRetry={() => mutateMe()} />
      </ScreenScroll>
    );
  }

  if (isLoading || !me) {
    return (
      <ScreenScroll>
        <RefreshSpinner active />
      </ScreenScroll>
    );
  }

  const handlePickProfilePicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til bilder for å sette profilbilde.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);

    setUploadingPicture(true);
    try {
      await api.updateProfilePicture(me.name, {
        uri: asset.uri,
        name: asset.fileName ?? `profile.${ext}`,
        type,
      });
      await mutateMe();
    } catch (err) {
      Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Kunne ikke laste opp bildet.');
    } finally {
      setUploadingPicture(false);
    }
  };

  const memberCount = members?.length ?? 0;
  const totalOwed = (expenses ?? [])
    .flatMap((e) => e.shares)
    .filter((s) => s.user.id === me.id && !s.paid)
    .reduce((sum, s) => sum + s.amountOwed, 0);

  const myWeeklyQuickActions = weeklyStats?.quickActionsByUser.find((entry) => entry.userId === me.id);
  const highlight =
    myWeeklyQuickActions && weeklyStats
      ? quickActionFlavor(myWeeklyQuickActions, weeklyStats.weekStart)
      : null;

  if (!me.collective) {
    return (
      <ScreenScroll eyebrow="Profil" title="Meg" refreshing={refreshing} onRefresh={handleRefresh}>
        <ProfileIdentity
          me={me}
          memberCount={0}
          onEditPicture={handlePickProfilePicture}
          uploadingPicture={uploadingPicture}
          onSettingsPress={() => router.push('/settings')}
        />

        <Card tone="brand">
          <ThemedText type="heading">Finn kollektivet ditt</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Opprett et nytt kollektiv eller bruk en invitasjonskode for å bli med i et eksisterende.
          </ThemedText>
          <PrimaryButton label="Gå til Hjem" onPress={() => router.replace('/')} />
        </Card>
      </ScreenScroll>
    );
  }

  // Actually bounded to the current Mon-Sun week. Previously this only checked "has a due
  // date at all", so the six slots filled up with the oldest overdue tasks and this week's
  // work never appeared - despite the heading promising exactly that.
  const weekStart = startOfWeekMonday(new Date());
  const weekEnd = addDays(weekStart, 6);
  const myWeekTasks = (tasks ?? [])
    .filter((t) => t.assignedTo?.id === me.id)
    .filter((t) => {
      const d = parseDueDateLocal(t.dueDate);
      return !!d && d >= weekStart && d <= weekEnd;
    })
    .sort((a, b) => {
      // Unfinished work first, then by date - a completed task shouldn't push a pending one
      // out of view.
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return parseDueDateLocal(a.dueDate)!.getTime() - parseDueDateLocal(b.dueDate)!.getTime();
    });

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={handleRefresh}>
      {myStatsError && !myStats ? (
        <ErrorState message="Klarte ikke å hente statistikk." onRetry={() => mutateMyStats()} />
      ) : myStats ? (
        <ProfileOverview
          me={me}
          memberCount={memberCount}
          totalOwed={totalOwed}
          onOwedPress={() => router.push('/shopping')}
          onEditPicture={handlePickProfilePicture}
          uploadingPicture={uploadingPicture}
          onSettingsPress={() => router.push('/settings')}
          level={myStats.level}
          lifetimePoints={myStats.lifetimePoints}
          weekPoints={myStats.weekPoints}
          pointsToNextLevel={myStats.pointsToNextLevel}
          levelProgressPercent={myStats.levelProgressPercent}
          badges={myStats.badges}
          streakDays={myStats.streakDays}
          weekQuickActions={myWeeklyQuickActions?.count ?? 0}
          highlight={highlight}
        />
      ) : (
        <ProfileIdentity
          me={me}
          memberCount={memberCount}
          onEditPicture={handlePickProfilePicture}
          uploadingPicture={uploadingPicture}
          onSettingsPress={() => router.push('/settings')}
        />
      )}

      {myStats && (
        <Section title="Aktivitet" meta={currentMonthLabel()}>
          <MonthActivityHeatmap data={myStats.monthActivity} />
        </Section>
      )}

      <Section title="Mine oppgaver denne uken">
        {myWeekTasks.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Du har ingen oppgaver denne uken. 🎉
          </ThemedText>
        ) : (
          <View style={styles.taskList}>
            {myWeekTasks.map((task, index) => {
              const d = parseDueDateLocal(task.dueDate);
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  subtitle={d ? formatShortDate(d) : undefined}
                  onToggle={handleToggleTask}
                  onActions={(t) =>
                    router.push({ pathname: '/tasks/new', params: { id: String(t.id) } })
                  }
                />
              );
            })}
          </View>
        )}
      </Section>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  taskList: {
    gap: Spacing.two + 2,
  },
});
