import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DayActivity } from '@/types/api';

const CELL_SIZE = 15;
const CELL_GAP = 3;

// Monday-first, matching the rest of the app's week convention. Only every-other label is
// shown (Man/Ons/Fre) - the same trick GitHub's own calendar uses to keep the label column
// narrow without making the grid ambiguous to read.
const WEEKDAY_LABELS = ['Man', '', 'Ons', '', 'Fre', '', ''];

const MONTH_NAMES_NB = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

/** Parses a yyyy-MM-dd key as a local date, so no time zone can shift it onto another day. */
function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Mon=0 ... Sun=6. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Groups the month's days into GitHub-style columns: one column per week, Mon-Sun top to bottom. */
function buildWeeks(days: DayActivity[]): (DayActivity | null)[][] {
  if (days.length === 0) return [];

  const leadingBlanks = mondayIndex(parseDateKey(days[0].date));
  const cells: (DayActivity | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayActivity | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** 0-4: how saturated a cell's fill should be, scaled against this month's own busiest day. */
function intensityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/** GitHub-style contribution calendar, scoped to the current month and colored with the
 *  active brand color instead of a hardcoded green (the app's palette is user-switchable). */
export function MonthActivityHeatmap({ data }: { data: DayActivity[] }) {
  const theme = useTheme();
  const weeks = buildWeeks(data);
  const max = Math.max(0, ...data.map((d) => d.count));
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const fillForLevel = (level: 0 | 1 | 2 | 3 | 4) =>
    level === 0 ? 'transparent' : `${theme.brand}${['', '40', '73', 'A6', 'FF'][level]}`;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.labelCol}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={[styles.weekdayLabel, { color: theme.textSecondary }]}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekCol}>
              {week.map((day, dayIndex) => {
                if (!day) return <View key={dayIndex} style={styles.cell} />;
                const level = intensityLevel(day.count, max);
                const isToday = day.date === todayKey;
                return (
                  <View
                    key={dayIndex}
                    style={[
                      styles.cell,
                      styles.cellFilled,
                      {
                        backgroundColor: fillForLevel(level),
                        borderColor: isToday ? theme.brand : theme.border,
                        borderWidth: isToday ? 1.5 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>Mindre</Text>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <View
            key={level}
            style={[
              styles.legendCell,
              {
                backgroundColor: fillForLevel(level),
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
          />
        ))}
        <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>Mer</Text>
      </View>
    </View>
  );
}

/** "August 2026" — for the Section title/meta wrapping this component. */
export function currentMonthLabel(): string {
  const now = new Date();
  const month = MONTH_NAMES_NB[now.getMonth()];
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${now.getFullYear()}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  labelCol: {
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  weekdayLabel: {
    fontSize: 10,
    lineHeight: CELL_SIZE + CELL_GAP,
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  weekCol: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 4,
  },
  cellFilled: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingTop: Spacing.two,
  },
  legendLabel: {
    fontSize: 11,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
