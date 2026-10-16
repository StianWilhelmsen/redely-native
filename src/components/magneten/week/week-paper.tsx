import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DateString, Member } from '@/api';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { FontFamily } from '@/constants/theme';
import { dayOfMonth, longDate, shortWeekday } from '@/lib/week-dates';
import { usePalette } from '@/theme/palette-context';

export type WeekItem = {
  key: string;
  kind: 'event' | 'note';
  id: string;
  title: string;
  /** "17:30", or null for all-day / no time. */
  time: string | null;
  member: Member | undefined;
  done: boolean;
  /** For an event occurrence: its start, so the detail screen shows this occurrence. */
  start?: string;
};

/** The week as one sheet of white paper, pinned to the door with two red pins. */
export function WeekPaper({ children }: { children: ReactNode }) {
  const { tokens } = usePalette();
  return (
    <View style={[styles.paper, { backgroundColor: tokens.paper }]}>
      <View style={[styles.pin, { left: 24, backgroundColor: tokens.magne }]} />
      <View style={[styles.pin, { right: 24, backgroundColor: tokens.magne }]} />
      {children}
    </View>
  );
}

export function DayRow({
  date,
  today,
  items,
  last,
  onPressItem,
  onPressDay,
}: {
  date: DateString;
  today: boolean;
  items: WeekItem[];
  last: boolean;
  onPressItem: (item: WeekItem) => void;
  /** Add something on this day - absent when the viewer can't. */
  onPressDay?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const lang = i18n.language;
  const dayColor = today ? tokens.magne : tokens.paperInk;

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: tokens.border, borderBottomWidth: last ? 0 : 1.5 },
        today && { backgroundColor: tokens.magne + '18' },
      ]}>
      <Pressable
        onPress={onPressDay}
        disabled={!onPressDay}
        accessibilityRole={onPressDay ? 'button' : 'header'}
        accessibilityLabel={
          onPressDay
            ? t('week.addOnDay', { day: longDate(date, lang) })
            : t('week.dayA11y', { day: longDate(date, lang), count: items.length })
        }
        style={styles.dayCol}>
        <Text style={[styles.dayName, { color: dayColor }]}>{shortWeekday(date, lang)}</Text>
        <Text style={[styles.dayDate, { color: today ? tokens.magne : tokens.textSecondary }]}>
          {today ? t('week.today') : t('week.dayDate', { day: dayOfMonth(date) })}
        </Text>
      </Pressable>
      <View style={styles.chips}>
        {items.map((item) => (
          <WeekChip key={item.key} item={item} onPress={() => onPressItem(item)} />
        ))}
      </View>
    </View>
  );
}

function WeekChip({ item, onPress }: { item: WeekItem; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const color = item.member?.color ?? tokens.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ checked: item.kind === 'note' ? item.done : undefined }}
      accessibilityLabel={[
        t(item.kind === 'event' ? 'week.chipEvent' : 'week.chipNote', { title: item.title }),
        item.time,
        item.member?.displayName,
      ]
        .filter(Boolean)
        .join(', ')}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: color + '24', opacity: item.done ? 0.55 : pressed ? 0.75 : 1 },
        item.kind === 'note' && { borderStyle: 'dashed', borderWidth: 1, borderColor: color + '80' },
      ]}>
      {item.member ? (
        <PhotoMagnet name={item.member.displayName} color={item.member.color} photoUrl={item.member.photoUrl} size={14} />
      ) : (
        <View style={[styles.dot, { backgroundColor: tokens.border }]} />
      )}
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: tokens.paperInk }, item.done && styles.struck]}>
        {item.title}
        {item.time ? <Text style={[styles.chipTime, { color: tokens.textSecondary }]}> {item.time}</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  paper: {
    marginTop: 8,
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 4,
    transform: [{ rotate: '-0.5deg' }],
    shadowColor: '#1E2D32',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  pin: {
    position: 'absolute',
    top: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    minHeight: 52,
  },
  dayCol: { width: 56, minHeight: 44, justifyContent: 'center' },
  dayName: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 20, lineHeight: 29 },
  dayDate: { fontFamily: FontFamily.semiBold, fontSize: 11.5 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', gap: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 999,
    maxWidth: '100%',
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  chipText: { fontFamily: FontFamily.semiBold, fontSize: 12.5, flexShrink: 1 },
  chipTime: { fontFamily: FontFamily.medium, fontSize: 11.5 },
  struck: { textDecorationLine: 'line-through' },
});
