import { StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, memberColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, localDateKey, parseDueDateLocal } from '@/lib/date-utils';
import type { Task } from '@/types/api';

/** Mon-Sun, matching the Norwegian week the rest of the app counts in. */
const COLUMN_LETTERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

type Day = {
  date: Date;
  key: string;
  tasks: Task[];
  /** Whoever the day belongs to - the colour of the dot and the face on the row. */
  owner: { id: number; name: string; pictureUrl: string | null } | null;
};

export function WeekPlan({ weekStart, tasks }: { weekStart: Date; tasks: Task[] }) {
  const theme = useTheme();
  const todayKey = localDateKey(new Date());

  const days: Day[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = localDateKey(date);
    const dayTasks = tasks.filter((task) => {
      const due = parseDueDateLocal(task.dueDate);
      return !!due && localDateKey(due) === key;
    });
    return { date, key, tasks: dayTasks, owner: dayTasks.find((t) => t.assignedTo)?.assignedTo ?? null };
  });

  const daysWithTasks = days.filter((day) => day.tasks.length > 0);

  return (
    <View style={styles.root}>
      <View style={styles.strip}>
        {days.map((day, index) => {
          const isToday = day.key === todayKey;
          return (
            <View key={day.key} style={styles.stripColumn}>
              <ThemedText
                type="small"
                themeColor={isToday ? 'text' : 'textSecondary'}
                style={[styles.stripLetter, isToday && styles.stripLetterToday]}>
                {COLUMN_LETTERS[index]}
              </ThemedText>
              <View
                style={[
                  styles.stripDate,
                  isToday && { backgroundColor: theme.brand },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.stripDateText, isToday && { color: theme.onBrand }]}>
                  {day.date.getDate()}
                </ThemedText>
              </View>
              {/* The dot repeats the colour of whoever the day belongs to, so the strip
                  reads as a rota at a glance before any row is read. */}
              <View
                style={[
                  styles.dot,
                  { backgroundColor: day.owner ? memberColor(day.owner.id) : 'transparent' },
                ]}
              />
            </View>
          );
        })}
      </View>

      {daysWithTasks.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Ingen planlagte oppgaver denne uka.
        </ThemedText>
      ) : (
        <View style={styles.rows}>
          {daysWithTasks.map((day) => {
            const allDone = day.tasks.every((task) => task.completed);
            return (
              <View key={day.key} style={styles.row}>
                <ThemedText type="smallBold" themeColor="brand" style={styles.rowDay}>
                  {DAY_NAMES[day.date.getDay() === 0 ? 6 : day.date.getDay() - 1]}
                </ThemedText>
                <ThemedText
                  type="small"
                  numberOfLines={2}
                  themeColor={allDone ? 'textSecondary' : 'text'}
                  style={[styles.rowTasks, allDone && styles.struck]}>
                  {day.tasks.map((task) => task.title).join(' · ')}
                </ThemedText>
                {day.owner && (
                  <AvatarBadge
                    userId={day.owner.id}
                    name={day.owner.name}
                    pictureUrl={day.owner.pictureUrl}
                    shape="circle"
                    size={30}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.four,
  },
  strip: {
    flexDirection: 'row',
  },
  stripColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  stripLetter: {
    fontSize: 11,
  },
  stripLetterToday: {
    fontFamily: FontFamily.semiBold,
  },
  stripDate: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripDateText: {
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  rows: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowDay: {
    width: 32,
  },
  rowTasks: {
    flex: 1,
    minWidth: 0,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  empty: {
    paddingVertical: Spacing.two,
  },
});
