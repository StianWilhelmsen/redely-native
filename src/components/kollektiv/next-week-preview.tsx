import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, localDateKey, parseDueDateLocal, weekdayLabel } from '@/lib/date-utils';
import type { Task } from '@/types/api';

const MAX_ROWS = 6;

/** A day-strip (with dot indicators) plus a flat list of what's coming up, for the week
 *  right after the current one. No prev/this/next navigation here on purpose - browsing
 *  further out lives on the dedicated "Alle uker" screen behind "Se alle". */
export function NextWeekPreview({ nextWeekStart, tasks }: { nextWeekStart: Date; tasks: Task[] }) {
  const theme = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i));

  const tasksByDay = new Map<string, Task[]>();
  for (const task of tasks) {
    const d = parseDueDateLocal(task.dueDate);
    if (!d) continue;
    const key = localDateKey(d);
    if (days.every((day) => localDateKey(day) !== key)) continue;
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key)!.push(task);
  }

  const rows = days
    .flatMap((day) => (tasksByDay.get(localDateKey(day)) ?? []).map((task) => ({ day, task })))
    .slice(0, MAX_ROWS);

  return (
    <View style={styles.root}>
      <View style={styles.strip}>
        {days.map((day, index) => {
          const hasTasks = tasksByDay.has(localDateKey(day));
          return (
            <View key={index} style={styles.dayCol}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
                {weekdayLabel(day).slice(0, 1)}
              </ThemedText>
              <View
                style={[
                  styles.dateChip,
                  index === 0 && { backgroundColor: theme.brand },
                ]}>
                <ThemedText type="smallBold" themeColor={index === 0 ? 'onBrand' : 'text'}>
                  {day.getDate()}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: hasTasks ? theme.brand : 'transparent' },
                ]}
              />
            </View>
          );
        })}
      </View>

      {rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Ingen oppgaver planlagt neste uke ennå.
        </ThemedText>
      ) : (
        <View style={styles.rows}>
          {rows.map(({ day, task }) => (
            <Pressable
              key={task.id}
              onPress={() => router.push({ pathname: '/tasks/new', params: { id: String(task.id) } })}
              style={styles.taskRow}>
              <ThemedText type="smallBold" themeColor="brand" style={styles.taskDay}>
                {weekdayLabel(day).slice(0, 3)}
              </ThemedText>
              <ThemedText type="small" numberOfLines={1} style={styles.taskTitle}>
                {task.title}
              </ThemedText>
              {task.assignedTo && (
                <AvatarBadge
                  userId={task.assignedTo.id}
                  name={task.assignedTo.name}
                  pictureUrl={task.assignedTo.pictureUrl}
                  shape="circle"
                  size={26}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function SeeAllWeeksLink() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Se alle uker"
      onPress={() => router.push('/weeks')}
      hitSlop={Spacing.two}
      style={styles.seeAll}>
      <ThemedText type="small" themeColor="brand">
        Se alle
      </ThemedText>
      <Ionicons name="chevron-forward" size={13} color={theme.brand} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.four,
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dayLabel: {
    fontSize: 11,
  },
  dateChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  rows: {
    gap: Spacing.three,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  taskDay: {
    width: 34,
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
