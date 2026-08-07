import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import useSWR, { useSWRConfig } from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { BarChart } from '@/components/bar-chart';
import { DonutProgress } from '@/components/donut-progress';
import { ErrorState } from '@/components/error-state';
import { LevelCard } from '@/components/me/level-card';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { TaskCard } from '@/components/tasks/task-card';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { addDays, formatShortDate, parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';
import type { Task } from '@/types/api';

function formatKr(amount: number): string {
  return `${Math.round(amount)} kr`;
}

export default function MeScreen() {
  const theme = useTheme();
  const { data: me, error: meError, isLoading, mutate: mutateMe } = useMe();
  const { mutate: globalMutate } = useSWRConfig();
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: myStats, error: myStatsError, mutate: mutateMyStats } = useSWR(
    me?.collective ? 'my-stats' : null,
    api.myStats
  );
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
      globalMutate('tasks'),
      globalMutate('expenses'),
    ]);
    setRefreshing(false);
  };

  if (meError) {
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

  const settingsButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Innstillinger"
      onPress={() => router.push('/settings')}
      hitSlop={Spacing.two}
      style={[styles.settingsButton, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="settings-outline" size={20} color={theme.text} />
    </Pressable>
  );

  return (
    <ScreenScroll
      eyebrow="Din side"
      title="Meg"
      headerRight={settingsButton}
      refreshing={refreshing}
      onRefresh={handleRefresh}>
      <View style={styles.profile}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Endre profilbilde"
          onPress={handlePickProfilePicture}
          disabled={uploadingPicture}
          style={styles.avatarWrap}>
          <AvatarBadge userId={me.id} name={me.name} pictureUrl={me.pictureUrl} shape="circle" size={84} />
          <View style={[styles.avatarEditBadge, { backgroundColor: theme.brand, borderColor: theme.background }]}>
            {uploadingPicture ? (
              <ActivityIndicator size="small" color={theme.onBrand} />
            ) : (
              <Ionicons name="camera" size={14} color={theme.onBrand} />
            )}
          </View>
        </Pressable>
        <ThemedText type="heading">{me.name}</ThemedText>
        {me.collective && (
          <ThemedText type="small" themeColor="textSecondary">
            {me.collective.name} · {memberCount} medlem{memberCount === 1 ? '' : 'mer'}
          </ThemedText>
        )}
        {totalOwed > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Du skylder ${formatKr(totalOwed)}. Gå til regninger.`}
            onPress={() => router.push('/shopping')}
            style={({ pressed }) => [
              styles.owedPill,
              { backgroundColor: `${theme.danger}1C` },
              pressed && styles.owedPillPressed,
            ]}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              Du skylder {formatKr(totalOwed)} →
            </ThemedText>
          </Pressable>
        )}
      </View>

      {myStatsError ? (
        <ErrorState message="Klarte ikke å hente statistikk." onRetry={() => mutateMyStats()} />
      ) : (
        myStats && (
        <>
          <LevelCard
            level={myStats.level}
            lifetimePoints={myStats.lifetimePoints}
            weekPoints={myStats.weekPoints}
            pointsToNextLevel={myStats.pointsToNextLevel}
            levelProgressPercent={myStats.levelProgressPercent}
            badges={myStats.badges}
          />

          <View style={[styles.statsCard, { backgroundColor: theme.backgroundElement }]}>
            <DonutProgress percent={myStats.completionPercentThisMonth} />
            <View style={styles.statsCardInfo}>
              <ThemedText type="heading">{myStats.completedThisMonth} oppgaver</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                fullført denne måneden
              </ThemedText>
              <View style={styles.streakLine}>
                <Image source={require('@/assets/icons/flame.png')} style={styles.streakIcon} contentFit="contain" />
                <ThemedText type="small" themeColor="textSecondary">
                  {myStats.streakDays} dager personlig streak
                </ThemedText>
              </View>
            </View>
          </View>

          <Section title="Din aktivitet siste 7 dager">
            <BarChart data={myStats.last7DaysActivity} />
          </Section>
        </>
        )
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
  profile: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owedPill: {
    marginTop: Spacing.one,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  owedPillPressed: {
    opacity: 0.75,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    borderRadius: Radii.card,
    padding: Spacing.four,
  },
  statsCardInfo: {
    flex: 1,
    gap: 2,
  },
  streakLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.one,
  },
  streakIcon: {
    width: 16,
    height: 16,
  },
  taskList: {
    gap: Spacing.two + 2,
  },
});
