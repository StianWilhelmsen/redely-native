import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { addDays, localDateKey, parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';
import { formatWeekRange, isoWeekNumber } from '@/lib/weekly-summary-copy';
import type { Task } from '@/types/api';

type WeekRow = {
  weekStart: Date;
  label: string;
  range: string;
  completed: number;
  planned: number;
};

function weekLabel(offsetFromCurrent: number, isoWeek: number): string {
  if (offsetFromCurrent === 0) return 'Denne uken';
  if (offsetFromCurrent === 1) return 'Neste uke';
  if (offsetFromCurrent === -1) return 'Forrige uke';
  return `Uke ${isoWeek}`;
}

/** Every Mon-Sun week that has at least one dated task, newest first, so browsing lines up
 *  with how the rest of the app talks about "denne uken"/"neste uke" before it thins out
 *  into bare week numbers. */
function buildWeeks(tasks: Task[]): WeekRow[] {
  const currentWeekStart = startOfWeekMonday(new Date());
  const dated = tasks.filter((t) => !t.quick && t.dueDate);

  let earliest = currentWeekStart;
  let latest = currentWeekStart;
  for (const task of dated) {
    const d = parseDueDateLocal(task.dueDate);
    if (!d) continue;
    const weekStart = startOfWeekMonday(d);
    if (weekStart < earliest) earliest = weekStart;
    if (weekStart > latest) latest = weekStart;
  }

  const rows: WeekRow[] = [];
  for (let cursor = earliest; cursor <= latest; cursor = addDays(cursor, 7)) {
    const weekEnd = addDays(cursor, 6);
    const inWeek = dated.filter((t) => {
      const d = parseDueDateLocal(t.dueDate)!;
      return d >= cursor && d <= weekEnd;
    });
    const offset = Math.round((cursor.getTime() - currentWeekStart.getTime()) / (7 * 86_400_000));
    rows.push({
      weekStart: cursor,
      label: weekLabel(offset, isoWeekNumber(localDateKey(cursor))),
      range: formatWeekRange(localDateKey(cursor), localDateKey(weekEnd)),
      completed: inWeek.filter((t) => t.completed).length,
      planned: inWeek.length,
    });
  }

  return rows.reverse();
}

export default function AllWeeksScreen() {
  const theme = useTheme();
  const { data: tasks, error, isLoading, mutate } = useSWR('tasks', api.tasks);

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

  const weeks = tasks ? buildWeeks(tasks) : [];

  return (
    <ScreenScroll eyebrow="Kollektiv" title="Alle uker" headerRight={closeButton}>
      {error ? (
        <ErrorState message="Klarte ikke å hente oppgavene." onRetry={() => mutate()} />
      ) : isLoading || !tasks ? (
        <RefreshSpinner active />
      ) : (
        <View>
          {weeks.map((week, index) => (
            <Fragment key={localDateKey(week.weekStart)}>
              {index > 0 && <Separator />}
              <Pressable
                onPress={() => router.push(`/weeks/${localDateKey(week.weekStart)}`)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.rowText}>
                  <ThemedText type="smallBold">{week.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {week.range}
                  </ThemedText>
                </View>
                {week.planned > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {week.completed}/{week.planned} oppgaver
                  </ThemedText>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </Pressable>
            </Fragment>
          ))}
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
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
});
