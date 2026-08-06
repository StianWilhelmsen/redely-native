import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { TaskCard } from '@/components/tasks/task-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  addDays,
  formatShortDate,
  localDateKey,
  parseDueDateLocal,
  startOfWeekMonday,
  weekdayLabel,
} from '@/lib/date-utils';
import type { Task } from '@/types/api';

export type TaskViewMode = 'today' | 'week';

type Group = { key: string; label: string; danger?: boolean; tasks: Task[] };

/** Groups actually still open (not done). Everything else (a completed list) is built separately. */
export function buildTaskGroups(tasks: Task[], mode: TaskViewMode): Group[] {
  const today = new Date();
  const todayKey = localDateKey(today);
  const tomorrowKey = localDateKey(addDays(today, 1));
  const weekStart = startOfWeekMonday(today);
  const weekEnd = addDays(weekStart, 6);

  const open = tasks.filter((t) => !t.completed);

  const overdue: Task[] = [];
  const byDay = new Map<string, Task[]>();
  const undated: Task[] = [];

  for (const task of open) {
    const d = parseDueDateLocal(task.dueDate);
    if (!d) {
      undated.push(task);
      continue;
    }
    const key = localDateKey(d);
    if (key < todayKey) {
      overdue.push(task);
      continue;
    }
    if (mode === 'today' && key !== todayKey) continue;
    if (mode === 'week' && (d < weekStart || d > weekEnd)) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(task);
  }

  const groups: Group[] = [];
  if (overdue.length > 0) {
    groups.push({ key: 'overdue', label: 'Forsinket', danger: true, tasks: overdue });
  }

  const dayKeys = Array.from(byDay.keys()).sort();
  for (const key of dayKeys) {
    const d = parseDueDateLocal(key)!;
    const label =
      key === todayKey
        ? `I dag, ${formatShortDate(d)}`
        : key === tomorrowKey
          ? `I morgen, ${formatShortDate(d)}`
          : `${weekdayLabel(d)}, ${formatShortDate(d)}`;
    groups.push({ key, label, tasks: byDay.get(key)! });
  }

  // Always shown regardless of mode - an undated task previously only appeared in
  // "week" mode, making it unreachable (and un-deletable) whenever "today" was active.
  if (undated.length > 0) {
    groups.push({ key: 'undated', label: 'Uten dato', tasks: undated });
  }

  return groups;
}

/** Completed tasks that fall within the current mode's date window (today, or this week). */
export function buildCompletedGroup(tasks: Task[], mode: TaskViewMode): Task[] {
  const today = new Date();
  const todayKey = localDateKey(today);
  const weekStart = startOfWeekMonday(today);
  const weekEnd = addDays(weekStart, 6);

  return tasks.filter((t) => {
    if (!t.completed) return false;
    const d = parseDueDateLocal(t.dueDate);
    if (!d) return true; // undated tasks stay reachable regardless of mode
    if (mode === 'today') return localDateKey(d) === todayKey;
    return d >= weekStart && d <= weekEnd;
  });
}

type Props = {
  tasks: Task[];
  mode: TaskViewMode;
  onToggle: (task: Task) => void;
  onActions?: (task: Task) => void;
  busyTaskId?: number | null;
  emptyTitle?: string;
  emptyText?: string;
};

/** Date-grouped floating task cards with eyebrow day labels, plus a completed list you can undo from. */
export function TaskGroups({
  tasks,
  mode,
  onToggle,
  onActions,
  busyTaskId = null,
  emptyTitle = 'Alt er gjort',
  emptyText,
}: Props) {
  const groups = buildTaskGroups(tasks, mode);
  const completed = buildCompletedGroup(tasks, mode);

  return (
    <View style={styles.stack}>
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Image
            source={require('@/assets/images/android-icon-foreground.png')}
            style={styles.emptyMark}
            contentFit="contain"
          />
          <ThemedText type="heading">{emptyTitle}</ThemedText>
          {emptyText && (
            <ThemedText type="small" themeColor="textSecondary">
              {emptyText}
            </ThemedText>
          )}
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <ThemedText type="eyebrow" themeColor={group.danger ? 'danger' : undefined}>
              {group.label}
            </ThemedText>
            <View style={styles.cards}>
              {group.tasks.map((task, index) => {
                const dueDate = group.key === 'overdue' ? parseDueDateLocal(task.dueDate) : null;
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    onToggle={onToggle}
                    onActions={onActions}
                    busy={busyTaskId === task.id}
                    subtitle={dueDate ? formatShortDate(dueDate) : undefined}
                  />
                );
              })}
            </View>
          </View>
        ))
      )}

      {completed.length > 0 && (
        <View style={styles.group}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Fullført
          </ThemedText>
          <View style={styles.cards}>
            {completed.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onToggle={onToggle}
                onActions={onActions}
                busy={busyTaskId === task.id}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  cards: {
    gap: Spacing.two + 2,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
  },
  emptyMark: {
    width: 56,
    height: 56,
    marginBottom: Spacing.one,
  },
});
