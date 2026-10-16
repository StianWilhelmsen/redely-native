import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import {
  api,
  errorMessage,
  keys,
  type CalendarEvent,
  type DateString,
  type EventInput,
  type Recurrence,
  type Uuid,
  type Visibility,
  type Weekday,
} from '@/api';
import { Magne } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { RoundButton } from '@/components/magneten/lists/round-button';
import { Button, Card, Chip, Field, Screen, Toggle } from '@/components/magneten/ui';
import { DateTimeField } from '@/components/magneten/week/date-time-field';
import { Segmented } from '@/components/magneten/week/segmented';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import {
  WEEKDAYS,
  addDays,
  addMinutes,
  longDate,
  minutesBetween,
  osloDate,
  osloIso,
  osloTime,
  osloToday,
  shortWeekday,
  weekdayOf,
} from '@/lib/week-dates';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

const REMINDERS: (number | null)[] = [null, 15, 30, 60, 1440];

type Form = {
  title: string;
  allDay: boolean;
  startDate: DateString;
  endDate: DateString;
  startTime: string;
  endTime: string;
  memberIds: Uuid[];
  driver: Uuid | null;
  recurrence: Recurrence;
  weekdays: Weekday[];
  until: DateString | null;
  reminder: number | null;
  location: string;
  description: string;
  visibility: Visibility;
};

function blank(date: DateString): Form {
  return {
    title: '',
    allDay: false,
    startDate: date,
    endDate: date,
    startTime: '17:00',
    endTime: '18:00',
    memberIds: [],
    driver: null,
    recurrence: 'NONE',
    weekdays: [weekdayOf(date)],
    until: null,
    reminder: null,
    location: '',
    description: '',
    visibility: 'ALL',
  };
}

function fromEvent(e: CalendarEvent): Form {
  const startDate = osloDate(e.startsAt);
  const lastMs = Math.max(Date.parse(e.startsAt), Date.parse(e.endsAt) - 1);
  return {
    title: e.title,
    allDay: e.allDay,
    startDate,
    endDate: e.allDay ? osloDate(lastMs) : startDate,
    startTime: e.allDay ? '17:00' : osloTime(e.startsAt),
    endTime: e.allDay ? '18:00' : osloTime(e.endsAt),
    memberIds: e.memberIds,
    driver: e.driverMemberId,
    recurrence: e.recurrence,
    weekdays: e.recurrenceWeekdays.length ? e.recurrenceWeekdays : [weekdayOf(startDate)],
    until: e.recurrenceUntil,
    reminder: e.reminderMinutes,
    location: e.location ?? '',
    description: e.description ?? '',
    visibility: e.visibility,
  };
}

/**
 * New event, or edit with `?id=`. Times are entered on the Oslo wall clock and sent with
 * Oslo's offset for that day (see `osloIso`), whatever zone the phone is in.
 */
export default function EventFormScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const lang = i18n.language;
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const editId = params.id || null;
  const { hid, members, memberById, membership } = useHousehold();
  const isHelper = membership.role === 'HELPER';

  const initialDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : osloToday();
  const [form, setForm] = useState<Form>(() => blank(initialDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useSWR(editId ? keys.event(hid, editId) : null, () => api.events.get(hid, editId!));
  const seeded = useRef(false);
  useEffect(() => {
    if (existing.data && !seeded.current) {
      seeded.current = true;
      setForm(fromEvent(existing.data));
    }
  }, [existing.data]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setError(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setStartDate = (d: DateString) =>
    setForm((f) => {
      const span = Math.max(0, Math.round((Date.parse(f.endDate) - Date.parse(f.startDate)) / 86_400_000));
      const keepWeekday = f.weekdays.length === 1 && f.weekdays[0] === weekdayOf(f.startDate);
      return {
        ...f,
        startDate: d,
        endDate: addDays(d, span),
        weekdays: keepWeekday ? [weekdayOf(d)] : f.weekdays,
      };
    });
  const setStartTime = (time: string) =>
    setForm((f) => ({ ...f, startTime: time, endTime: addMinutes(time, Math.max(15, minutesBetween(f.startTime, f.endTime))) }));

  const toggleMember = (id: Uuid) =>
    set('memberIds', form.memberIds.includes(id) ? form.memberIds.filter((m) => m !== id) : [...form.memberIds, id]);
  const toggleWeekday = (d: Weekday) => {
    const next = form.weekdays.includes(d) ? form.weekdays.filter((w) => w !== d) : [...form.weekdays, d];
    set('weekdays', next.length ? WEEKDAYS.filter((w) => next.includes(w)) : form.weekdays);
  };

  const save = async () => {
    const title = form.title.trim();
    if (!title) return setError(t('week.form.titleRequired'));
    if (!form.allDay && minutesBetween(form.startTime, form.endTime) <= 0) return setError(t('week.form.endBeforeStart'));
    if (form.allDay && form.endDate < form.startDate) return setError(t('week.form.endBeforeStart'));

    const input: EventInput = {
      title,
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      allDay: form.allDay,
      startsAt: osloIso(form.startDate, form.allDay ? '00:00' : form.startTime),
      endsAt: form.allDay ? osloIso(addDays(form.endDate, 1), '00:00') : osloIso(form.startDate, form.endTime),
      recurrence: form.recurrence,
      recurrenceWeekdays: form.recurrence === 'WEEKLY' ? form.weekdays : [],
      recurrenceUntil: form.recurrence === 'NONE' ? null : form.until,
      reminderMinutes: form.reminder,
      visibility: form.visibility,
      driverMemberId: form.driver,
      memberIds: form.memberIds,
    };

    setSaving(true);
    try {
      const saved = editId ? await api.events.update(hid, editId, input) : await api.events.create(hid, input);
      mutate(keys.event(hid, saved.id), saved, { revalidate: false });
      mutate((key) => Array.isArray(key) && key[0] === 'events' && key[1] === hid);
      Feel.smack();
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert(errorMessage(e));
    }
  };

  if (editId && !existing.data) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        {existing.error ? (
          <>
            <Magne pose="lurer" size={90} />
            <Text style={[styles.body, { color: tokens.textSecondary }]}>{errorMessage(existing.error)}</Text>
            <Button label={t('actions.back')} variant="outline" onPress={() => router.back()} />
          </>
        ) : (
          <ActivityIndicator color={tokens.text} />
        )}
      </Screen>
    );
  }

  const magnetMember = memberById(form.memberIds[0]) ?? memberById(membership.memberId);
  const summary = form.allDay
    ? form.endDate > form.startDate
      ? t('week.form.summaryAllDayRange', { from: longDate(form.startDate, lang), to: longDate(form.endDate, lang) })
      : t('week.form.summaryAllDay', { date: longDate(form.startDate, lang) })
    : t('week.form.summaryTimed', { date: longDate(form.startDate, lang), from: form.startTime, to: form.endTime });

  const drivers = members.filter((m) => m.role !== 'CHILD');
  const visOptions: { value: Visibility; label: string }[] = [
    { value: 'ALL', label: t('week.form.visAll') },
    ...(isHelper ? [] : [{ value: 'ADULTS' as Visibility, label: t('week.form.visAdults') }]),
    { value: 'PRIVATE', label: t('week.form.visPrivate') },
  ];
  const reminderLabel = (r: number | null) =>
    r == null
      ? t('week.form.reminderNone')
      : r === 60
        ? t('week.form.reminderHour')
        : r === 1440
          ? t('week.form.reminderDay')
          : t('week.form.reminderMinutes', { count: r });

  return (
    <Screen>
      <View style={styles.topBar}>
        <RoundButton icon="close" label={t('actions.cancel')} onPress={() => router.back()} size={40} />
        {editId ? (
          <Text style={[styles.topTitle, { color: tokens.text }]}>{t('week.form.titleEdit')}</Text>
        ) : (
          <Segmented
            tone="paper"
            value="event"
            onChange={(v) => v === 'note' && router.replace('/note/new')}
            options={[
              { value: 'note', label: t('week.form.tabNote') },
              { value: 'event', label: t('week.form.tabEvent') },
            ]}
          />
        )}
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.paper, { backgroundColor: tokens.paperYellow }]}>
        <View style={styles.magnet} pointerEvents="none">
          {magnetMember ? (
            <PhotoMagnet name={magnetMember.displayName} color={magnetMember.color} photoUrl={magnetMember.photoUrl} size={30} />
          ) : null}
        </View>
        <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{t('week.form.whatLabel')}</Text>
        <TextInput
          value={form.title}
          onChangeText={(v) => set('title', v)}
          placeholder={t('week.form.placeholder')}
          placeholderTextColor={tokens.textSecondary}
          accessibilityLabel={t('week.form.whatLabel')}
          maxLength={200}
          autoFocus={!editId}
          returnKeyType="done"
          style={[styles.titleInput, { color: tokens.paperInk, borderBottomColor: tokens.paperInk }]}
        />
        <Text style={[styles.summary, { color: tokens.textSecondary }]}>{summary}</Text>
      </View>

      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}

      <Card>
        <Line label={t('week.form.allDay')}>
          <Toggle value={form.allDay} onChange={(v) => set('allDay', v)} label={t('week.form.allDay')} />
        </Line>
        <Line label={form.allDay ? t('week.form.firstDay') : t('week.form.date')}>
          <DateTimeField mode="date" date={form.startDate} onChange={setStartDate} />
        </Line>
        {form.allDay ? (
          <Line label={t('week.form.lastDay')}>
            <DateTimeField
              mode="date"
              date={form.endDate}
              minimumDate={form.startDate}
              onChange={(d) => set('endDate', d)}
            />
          </Line>
        ) : (
          <>
            <Line label={t('week.form.starts')}>
              <DateTimeField mode="time" date={form.startDate} time={form.startTime} onChange={setStartTime} />
            </Line>
            <Line label={t('week.form.ends')} last>
              <DateTimeField mode="time" date={form.startDate} time={form.endTime} onChange={(v) => set('endTime', v)} />
            </Line>
          </>
        )}
      </Card>

      <View style={styles.group}>
        <Block label={t('week.form.who')}>
          <View style={styles.wrap}>
            {members.map((m) => (
              <Chip
                key={m.id}
                label={m.displayName}
                selected={form.memberIds.includes(m.id)}
                onPress={() => toggleMember(m.id)}
                member={{ name: m.displayName, color: m.color, photoUrl: m.photoUrl }}
              />
            ))}
          </View>
        </Block>
        <Block label={t('week.form.driver')}>
          <View style={styles.wrap}>
            <Chip label={t('week.form.nobody')} selected={!form.driver} onPress={() => set('driver', null)} />
            {drivers.map((m) => (
              <Chip
                key={m.id}
                label={m.displayName}
                selected={form.driver === m.id}
                onPress={() => set('driver', form.driver === m.id ? null : m.id)}
                member={{ name: m.displayName, color: m.color, photoUrl: m.photoUrl }}
              />
            ))}
          </View>
        </Block>
      </View>

      <View style={styles.group}>
        <Block label={t('week.form.repeat')}>
          <View style={styles.wrap}>
            {(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as Recurrence[]).map((r) => (
              <Chip
                key={r}
                label={t(
                  {
                    NONE: 'week.form.repeatNone',
                    DAILY: 'week.form.repeatDaily',
                    WEEKLY: 'week.form.repeatWeekly',
                    MONTHLY: 'week.form.repeatMonthly',
                  }[r]
                )}
                selected={form.recurrence === r}
                onPress={() => set('recurrence', r)}
              />
            ))}
          </View>
        </Block>
        {form.recurrence === 'WEEKLY' ? (
          <Block label={t('week.form.onDays')}>
            <View style={styles.wrap}>
              {WEEKDAYS.map((d, i) => (
                <Chip
                  key={d}
                  label={shortWeekday(addDays('2026-10-19', i), lang)}
                  selected={form.weekdays.includes(d)}
                  onPress={() => toggleWeekday(d)}
                />
              ))}
            </View>
          </Block>
        ) : null}
        {form.recurrence !== 'NONE' ? (
          <Block label={t('week.form.until')}>
            <View style={[styles.wrap, { alignItems: 'center' }]}>
              <Chip label={t('week.form.untilNever')} selected={!form.until} onPress={() => set('until', null)} />
              <Chip
                label={t('week.form.untilDate')}
                selected={!!form.until}
                onPress={() => set('until', form.until ?? addDays(form.startDate, 56))}
              />
              {form.until ? (
                <DateTimeField
                  mode="date"
                  date={form.until}
                  minimumDate={form.startDate}
                  onChange={(d) => set('until', d)}
                />
              ) : null}
            </View>
          </Block>
        ) : null}
      </View>

      <View style={styles.group}>
        <Block label={t('week.form.reminder')}>
          <View style={styles.wrap}>
            {REMINDERS.map((r) => (
              <Chip key={String(r)} label={reminderLabel(r)} selected={form.reminder === r} onPress={() => set('reminder', r)} />
            ))}
          </View>
        </Block>
      </View>

      <Field
        label={t('week.form.location')}
        value={form.location}
        onChangeText={(v) => set('location', v)}
        placeholder={t('week.form.locationPlaceholder')}
        maxLength={200}
      />
      <Field
        label={t('week.form.notes')}
        value={form.description}
        onChangeText={(v) => set('description', v)}
        placeholder={t('week.form.notesPlaceholder')}
        maxLength={2000}
        multiline
      />

      <Card style={{ paddingVertical: 12, gap: 8 }}>
        <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('week.form.visibility')}</Text>
        <Segmented value={form.visibility} onChange={(v) => set('visibility', v)} options={visOptions} />
        {form.visibility === 'PRIVATE' ? (
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>{t('week.form.visPrivateHint')}</Text>
        ) : null}
      </Card>

      <Button label={editId ? t('week.form.saveEdit') : t('week.form.save')} onPress={save} loading={saving} />
    </Screen>
  );
}

function Line({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  const { tokens } = usePalette();
  return (
    <View style={[styles.line, !last && { borderBottomWidth: 1, borderBottomColor: tokens.backgroundSelected }]}>
      <Text style={[styles.lineLabel, { color: tokens.text }]}>{label}</Text>
      {children}
    </View>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  const { tokens } = usePalette();
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: FontFamily.bold, fontSize: 15 },
  paper: {
    marginTop: 14,
    paddingTop: 26,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 4,
    transform: [{ rotate: '0.6deg' }],
    shadowColor: '#1E2D32',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  magnet: { position: 'absolute', top: -14, left: 0, right: 0, alignItems: 'center' },
  kicker: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.7 },
  titleInput: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 28, lineHeight: 41, paddingVertical: 2, borderBottomWidth: 2 },
  summary: { fontFamily: FontFamily.regular, fontSize: 13, paddingTop: 6 },
  error: { fontFamily: FontFamily.semiBold, fontSize: 14, paddingHorizontal: 4 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 54, paddingVertical: 6 },
  lineLabel: { fontFamily: FontFamily.semiBold, fontSize: 14.5 },
  group: { gap: 12 },
  block: { gap: 8 },
  label: { fontFamily: FontFamily.bold, fontSize: 13, paddingLeft: 4 },
  hint: { fontFamily: FontFamily.regular, fontSize: 12.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
