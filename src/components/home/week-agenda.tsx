import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AvatarBadge } from '@/components/avatar-badge';
import { FlatDivider } from '@/components/flat-divider';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { rowEntrance } from '@/lib/animations';
import { addDays, localDateKey, parseDueDateLocal } from '@/lib/date-utils';
import type { Task } from '@/types/api';

const DAY_ABBREVIATIONS = ['SØN', 'MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR'];

type Props = {
  tasks: Task[];
  meId: number | undefined;
  /** First and last day to lay out, inclusive. */
  from: Date;
  to: Date;
  /** Tasks due today that belong to the signed-in member live in their own list above,
   *  so today's group leaves them out rather than showing them twice. */
  hideMineOn?: string;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  emptyText: string;
};

type DayGroup = { date: Date; key: string; tasks: Task[] };

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The household's week as an agenda: one band per day, every chore under the day it is
 * due, whoever it belongs to. Your own rows tick on a tap like the list above; the
 * others' are there to be seen, since the backend only lets the owner tick a chore.
 */
export function WeekAgenda({ tasks, meId, from, to, hideMineOn, onToggle, onOpen, emptyText }: Props) {
  const theme = useTheme();
  const todayKey = localDateKey(new Date());

  const days: DayGroup[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const key = localDateKey(cursor);
    const dayTasks = tasks
      .filter((task) => {
        if (task.quick) return false;
        const due = parseDueDateLocal(task.dueDate);
        if (!due || localDateKey(due) !== key) return false;
        if (hideMineOn === key && task.assignedTo?.id === meId) return false;
        return true;
      })
      .sort((a, b) => Number(a.completed) - Number(b.completed) || a.title.localeCompare(b.title, 'nb'));
    if (dayTasks.length > 0) days.push({ date: cursor, key, tasks: dayTasks });
  }

  if (days.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
        {emptyText}
      </ThemedText>
    );
  }

  let rowIndex = 0;

  return (
    <View>
      {days.map((day, dayIndex) => {
        const isToday = day.key === todayKey;
        return (
          <Fragment key={day.key}>
            {dayIndex > 0 && <FlatDivider />}
            <View style={styles.day}>
              <View style={styles.dayLabel}>
                <ThemedText
                  style={[styles.dayName, { color: isToday ? theme.brand : theme.textSecondary }]}>
                  {DAY_ABBREVIATIONS[day.date.getDay()]}
                </ThemedText>
                <View style={[styles.dayNumber, isToday && { backgroundColor: theme.brand }]}>
                  <ThemedText
                    style={[styles.dayNumberText, { color: isToday ? theme.onBrand : theme.text }]}>
                    {day.date.getDate()}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.rows}>
                {day.tasks.map((task) => {
                  const mine = task.assignedTo?.id === meId;
                  const index = rowIndex++;
                  return (
                    <Animated.View key={task.id} entering={rowEntrance(index)}>
                      <Pressable
                        accessibilityRole={mine ? 'checkbox' : 'button'}
                        accessibilityState={mine ? { checked: task.completed } : undefined}
                        accessibilityLabel={`${task.title}, ${task.assignedTo ? firstName(task.assignedTo.name) : 'ingen'}`}
                        accessibilityHint={mine ? 'Hold inne for å endre oppgaven' : 'Åpner oppgaven'}
                        onPress={() => (mine ? onToggle(task) : onOpen(task))}
                        onLongPress={() => onOpen(task)}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                        {task.assignedTo ? (
                          <AvatarBadge
                            userId={task.assignedTo.id}
                            name={task.assignedTo.name}
                            pictureUrl={task.assignedTo.pictureUrl}
                            shape="circle"
                            size={28}
                          />
                        ) : (
                          <View style={[styles.unassigned, { borderColor: theme.border }]} />
                        )}
                        <ThemedText
                          type="default"
                          numberOfLines={1}
                          style={[styles.title, task.completed && styles.completed]}>
                          {task.title}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {mine ? 'deg' : task.assignedTo ? firstName(task.assignedTo.name) : 'ingen'}
                        </ThemedText>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dayLabel: {
    width: 36,
    alignItems: 'center',
    gap: 2,
    paddingTop: Spacing.two,
  },
  dayName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  dayNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  rows: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two,
  },
  unassigned: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  completed: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  empty: {
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
