import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import useSWR from 'swr';

import { api, errorMessage, keys, type DateString, type Uuid } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { RoundButton } from '@/components/magneten/lists/round-button';
import { Sheet } from '@/components/magneten/lists/sheet';
import { Button, Chip, Screen, Title } from '@/components/magneten/ui';
import { DayRow, WeekPaper, type WeekItem } from '@/components/magneten/week/week-paper';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { addDays, dayOfMonth, isoWeek, monthName, mondayOf, occurrenceDays, osloTime, osloToday } from '@/lib/week-dates';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function WeekScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const lang = i18n.language;
  const { hid, members, memberById, membership } = useHousehold();
  const canCreate = membership.role !== 'CHILD';

  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<Uuid | null>(null);
  const [planSheet, setPlanSheet] = useState(false);

  const today = osloToday();
  const mon = addDays(mondayOf(today), offset * 7);
  const sun = addDays(mon, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(mon, i)), [mon]);
  const week = isoWeek(mon);

  const events = useSWR(keys.events(hid, mon, sun), () => api.events.range(hid, mon, sun), { keepPreviousData: true });
  const notes = useSWR(
    keys.notes(hid, `week:${mon}`),
    () => api.notes.list(hid, { status: 'all', dueFrom: mon, dueTo: sun }),
    { keepPreviousData: true }
  );

  const byDay = useMemo(() => {
    const map = new Map<DateString, WeekItem[]>(days.map((d) => [d, []]));
    for (const occ of events.data ?? []) {
      const e = occ.event;
      if (filter && !e.memberIds.includes(filter) && e.driverMemberId !== filter) continue;
      const span = occurrenceDays(occ.startsAt, occ.endsAt);
      span.forEach((d, i) => {
        map.get(d)?.push({
          key: `e:${occ.eventId}:${occ.startsAt}:${d}`,
          kind: 'event',
          id: occ.eventId,
          title: e.title,
          time: e.allDay || i > 0 ? null : osloTime(occ.startsAt),
          member: memberById(e.memberIds[0] ?? e.driverMemberId),
          done: false,
          start: occ.startsAt,
        });
      });
    }
    for (const n of notes.data ?? []) {
      if (!n.dueDate) continue;
      if (filter && n.assigneeMemberId !== filter) continue;
      map.get(n.dueDate)?.push({
        key: `n:${n.id}`,
        kind: 'note',
        id: n.id,
        title: n.title,
        time: n.dueTime,
        member: memberById(n.assigneeMemberId),
        done: !!n.completedAt,
      });
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return map;
  }, [days, events.data, notes.data, filter, memberById]);

  const total = [...byDay.values()].reduce((s, l) => s + l.length, 0);
  const loading = (events.isLoading || notes.isLoading) && !events.data && !notes.data;
  const error = events.error ?? notes.error;
  const filterName = filter ? memberById(filter)?.displayName : undefined;

  const range =
    monthName(mon, lang) === monthName(sun, lang)
      ? t('week.rangeSameMonth', { from: dayOfMonth(mon), to: dayOfMonth(sun), month: monthName(sun, lang) })
      : t('week.rangeTwoMonths', {
          from: dayOfMonth(mon),
          fromMonth: monthName(mon, lang),
          to: dayOfMonth(sun),
          toMonth: monthName(sun, lang),
        });
  const title =
    offset === 0
      ? t('week.title.current')
      : offset === 1
        ? t('week.title.next')
        : offset === -1
          ? t('week.title.prev')
          : t('week.title.other', { week });

  const openItem = (item: WeekItem) => {
    if (item.kind === 'event') router.push({ pathname: '/event/[id]', params: { id: item.id, start: item.start } });
    else router.push({ pathname: '/note/[id]', params: { id: item.id } });
  };
  const newEvent = (date?: DateString) =>
    router.push({ pathname: '/event/new', params: { date: date ?? (offset === 0 ? today : mon) } });

  return (
    <Screen tabs>
      <Title
        kicker={t('week.kicker', { week, range })}
        title={title}
        right={
          <Pressable
            onPress={() => {
              Feel.tick();
              setPlanSheet(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('week.readPlan')}
            style={({ pressed }) => [styles.readPlan, { backgroundColor: tokens.magne, opacity: pressed ? 0.85 : 1 }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M3 7.5h4l1.5-2.5h7L17 7.5h4V19H3z"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
              <Circle cx={12} cy={13} r={3.5} fill="none" stroke="#FFFFFF" strokeWidth={2.2} />
            </Svg>
            <Text style={styles.readPlanText}>{t('week.readPlan')}</Text>
          </Pressable>
        }
      />

      <View style={styles.navRow}>
        <RoundButton icon="prev" label={t('week.prevWeek')} onPress={() => setOffset((o) => o - 1)} />
        <RoundButton icon="next" label={t('week.nextWeek')} onPress={() => setOffset((o) => o + 1)} />
        {offset !== 0 ? <Chip label={t('week.thisWeek')} onPress={() => setOffset(0)} /> : null}
        <View style={{ flex: 1 }} />
        {canCreate ? <RoundButton icon="plus" variant="magne" label={t('week.addEvent')} onPress={() => newEvent()} /> : null}
      </View>

      {members.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label={t('week.filterAll')} selected={!filter} onPress={() => setFilter(null)} />
          {members.map((m) => (
            <Chip
              key={m.id}
              label={m.displayName}
              selected={filter === m.id}
              onPress={() => setFilter(filter === m.id ? null : m.id)}
              member={{ name: m.displayName, color: m.color, photoUrl: m.photoUrl }}
            />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <Magne pose="trekker" size={90} />
          <Text style={[styles.hand, { color: tokens.textSecondary }]}>{t('week.loading')}</Text>
        </View>
      ) : (
        <>
          {error && !events.data ? (
            <View style={styles.center}>
              <Magne pose="lurer" size={80} />
              <Text style={[styles.body, { color: tokens.textSecondary }]}>{errorMessage(error)}</Text>
              <Button
                label={t('actions.retry')}
                variant="outline"
                onPress={() => {
                  events.mutate();
                  notes.mutate();
                }}
              />
            </View>
          ) : null}
          <WeekPaper>
            {days.map((d, i) => (
              <DayRow
                key={d}
                date={d}
                today={d === today}
                items={byDay.get(d) ?? []}
                last={i === 6}
                onPressItem={openItem}
                onPressDay={canCreate ? () => newEvent(d) : undefined}
              />
            ))}
          </WeekPaper>
          {total === 0 && !error ? (
            <View style={styles.emptyRow}>
              <Magne pose="sover" size={56} />
              <Text style={[styles.hand, { color: tokens.textSecondary, flex: 1 }]}>
                {filterName ? t('week.emptyFiltered', { name: filterName }) : t('week.empty')}
              </Text>
            </View>
          ) : null}
        </>
      )}

      <Sheet visible={planSheet} onClose={() => setPlanSheet(false)} title={t('week.readPlanSoonTitle')}>
        <View style={styles.soon}>
          <Magne pose="hei" size={80} />
          <Text style={[styles.hand, { color: tokens.text, flex: 1 }]}>{t('week.readPlanSoon')}</Text>
        </View>
        <Button label={t('week.gotIt')} onPress={() => setPlanSheet(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 999,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  readPlanText: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: 13 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filters: { gap: 6, paddingRight: 18 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  hand: { fontFamily: FontFamily.hand, fontSize: 19, lineHeight: 24 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingTop: 6 },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
