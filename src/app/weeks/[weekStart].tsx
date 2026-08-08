import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { addDays, localDateKey, parseDueDateLocal, startOfWeekMonday, weekdayLabel } from '@/lib/date-utils';
import { formatWeekRange, isoWeekNumber } from '@/lib/weekly-summary-copy';
import type { Task } from '@/types/api';

export default function WeekDetailScreen() {
  const theme = useTheme();
  const { weekStart: weekStartParam } = useLocalSearchParams<{ weekStart: string }>();
  const { data: tasks, error, isLoading, mutate } = useSWR('tasks', api.tasks);

  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam ?? '')
    ? parseDueDateLocal(weekStartParam)
    : null;
  const weekStart = startOfWeekMonday(requestedDate ?? new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const tasksByDay = new Map<string, Task[]>();
  for (const task of tasks ?? []) {
    const d = parseDueDateLocal(task.dueDate);
    if (!d || d < weekStart || d > weekEnd) continue;
    const key = localDateKey(d);
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key)!.push(task);
  }

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lukk"
      onPress={() => router.back()}
      hitSlop={Spacing.two}
      style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="close" size={20} color={theme.text} />
    </Pressable>
  );

  return (
    <ScreenScroll
      eyebrow={`Uke ${isoWeekNumber(localDateKey(weekStart))}`}
      title={formatWeekRange(localDateKey(weekStart), localDateKey(weekEnd))}
      headerRight={closeButton}>
      {error ? (
        <ErrorState message="Klarte ikke å hente oppgavene." onRetry={() => mutate()} />
      ) : isLoading || !tasks ? (
        <RefreshSpinner active />
      ) : (
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
  card: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
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
});
