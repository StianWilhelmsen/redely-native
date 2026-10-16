import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { api, errorMessage, keys, type CalendarEvent, type Comment, type Member } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { RoundButton } from '@/components/magneten/lists/round-button';
import { Button, Card, Chip, Row, Screen, SectionLabel } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { WEEKDAYS, addDays, formatDate, intlLocale, longDate, longWeekday, osloDate, osloTime } from '@/lib/week-dates';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function EventScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const lang = i18n.language;
  const { mutate } = useSWRConfig();
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const { hid, memberById, membership } = useHousehold();
  const canEdit = membership.role !== 'CHILD';

  const { data: event, error, mutate: mutateEvent } = useSWR(keys.event(hid, id), () => api.events.get(hid, id));
  const comments = useSWR(keys.eventComments(hid, id), () => api.events.comments(hid, id));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  if (!event) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        {error ? (
          <>
            <Magne pose="lurer" size={90} />
            <Text style={[styles.body, { color: tokens.textSecondary }]}>
              {(error as { code?: string }).code === 'event_not_found' ? t('week.event.notFound') : errorMessage(error)}
            </Text>
            <Button label={t('actions.back')} variant="outline" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Magne pose="trekker" size={90} />
            <ActivityIndicator color={tokens.textSecondary} />
          </>
        )}
      </Screen>
    );
  }

  const when = describeWhen(event, start, lang, t);
  const concerned = event.memberIds.map((m) => memberById(m)).filter((m): m is Member => !!m);
  const driver = memberById(event.driverMemberId);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const c = await api.events.addComment(hid, id, text);
      setDraft('');
      Feel.tick();
      comments.mutate((list) => [...(list ?? []), c], { revalidate: false });
      mutateEvent((e) => (e ? { ...e, commentCount: e.commentCount + 1 } : e), { revalidate: false });
    } catch (e) {
      Alert.alert(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const remove = () =>
    Alert.alert(
      t('week.event.deleteTitle'),
      event.recurrence === 'NONE' ? t('week.event.deleteSingle') : t('week.event.deleteSeries'),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('actions.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.events.delete(hid, id);
              Feel.tear();
              mutate((key) => Array.isArray(key) && key[0] === 'events' && key[1] === hid);
              router.back();
            } catch (e) {
              Alert.alert(errorMessage(e));
            }
          },
        },
      ]
    );

  return (
    <Screen>
      <View style={styles.topBar}>
        <RoundButton icon="back" label={t('actions.back')} onPress={() => router.back()} size={40} />
        {canEdit ? (
          <Button
            label={t('week.event.edit')}
            variant="ink"
            style={styles.editBtn}
            onPress={() => router.push({ pathname: '/event/new', params: { id } })}
          />
        ) : null}
      </View>

      <View style={[styles.paper, { backgroundColor: tokens.paperYellow }]}>
        <View style={styles.magnets} pointerEvents="none">
          {(concerned.length ? concerned : driver ? [driver] : []).slice(0, 4).map((m) => (
            <PhotoMagnet key={m.id} name={m.displayName} color={m.color} photoUrl={m.photoUrl} size={30} />
          ))}
        </View>
        <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{t('week.event.kicker').toUpperCase()}</Text>
        <Text style={[styles.title, { color: tokens.paperInk }]} accessibilityRole="header">
          {event.title}
        </Text>
        <Text style={[styles.when, { color: tokens.paperInk }]}>{when}</Text>
        {event.description ? (
          <Text style={[styles.desc, { color: tokens.paperInk }]}>{event.description}</Text>
        ) : null}
      </View>

      <Card>
        {event.location ? <Row label={t('week.event.where')} value={event.location} /> : null}
        {concerned.length ? (
          <View style={styles.chipRow}>
            <Text style={[styles.rowLabel, { color: tokens.text }]}>{t('week.event.who')}</Text>
            <View style={styles.wrap}>
              {concerned.map((m) => (
                <MemberTag key={m.id} member={m} />
              ))}
            </View>
          </View>
        ) : null}
        {driver ? (
          <View style={styles.chipRow}>
            <Text style={[styles.rowLabel, { color: tokens.text }]}>{t('week.event.driver')}</Text>
            <MemberTag member={driver} />
          </View>
        ) : null}
        {event.recurrence !== 'NONE' ? (
          <Row label={t('week.event.repeat')} value={describeRepeat(event, lang, t)} />
        ) : null}
        {event.reminderMinutes != null ? (
          <Row label={t('week.event.reminder')} value={describeReminder(event.reminderMinutes, t)} />
        ) : null}
        <Row
          label={t('week.event.visibility')}
          value={t(
            { ALL: 'week.form.visAll', ADULTS: 'week.form.visAdults', PRIVATE: 'week.form.visPrivate' }[event.visibility]
          )}
        />
      </Card>

      <SectionLabel>{t('week.event.comments')}</SectionLabel>
      {(comments.data ?? []).length === 0 && !comments.isLoading ? (
        <Text style={[styles.body, { color: tokens.textSecondary, textAlign: 'left', paddingHorizontal: 4 }]}>
          {t('week.event.noComments')}
        </Text>
      ) : null}
      {(comments.data ?? []).map((c) => (
        <CommentRow key={c.id} comment={c} member={memberById(c.memberId)} lang={lang} />
      ))}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('week.event.commentPlaceholder')}
          placeholderTextColor={tokens.textSecondary}
          accessibilityLabel={t('week.event.commentPlaceholder')}
          maxLength={2000}
          multiline
          style={[styles.input, { backgroundColor: tokens.paper, color: tokens.text, borderColor: tokens.border }]}
        />
        <RoundButton icon="send" variant="ink" label={t('week.event.send')} onPress={send} disabled={!draft.trim() || sending} />
      </View>

      {canEdit ? <Button label={t('week.event.delete')} variant="ghost" onPress={remove} /> : null}
    </Screen>
  );
}

function MemberTag({ member }: { member: Member }) {
  return <Chip label={member.displayName} member={{ name: member.displayName, color: member.color, photoUrl: member.photoUrl }} />;
}

function CommentRow({ comment, member, lang }: { comment: Comment; member: Member | undefined; lang: string }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const name = member?.displayName ?? t('week.event.someone');
  const at = new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(comment.createdAt));
  return (
    <View style={styles.comment}>
      <PhotoMagnet name={name} color={member?.color ?? tokens.border} photoUrl={member?.photoUrl} size={30} />
      <View style={[styles.bubble, { backgroundColor: tokens.paper }]}>
        <Text style={[styles.commentMeta, { color: tokens.textSecondary }]}>
          <Text style={{ color: tokens.text, fontFamily: FontFamily.bold }}>{name}</Text> · {at}
        </Text>
        <Text style={[styles.commentText, { color: tokens.text }]}>{comment.text}</Text>
      </View>
    </View>
  );
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/** "Lørdag 24. oktober · 12:00–15:00", for the tapped occurrence when we know it. */
function describeWhen(event: CalendarEvent, occurrenceStart: string | undefined, lang: string, t: T): string {
  const startMs = Date.parse(occurrenceStart || event.startsAt);
  const duration = Date.parse(event.endsAt) - Date.parse(event.startsAt);
  const endMs = startMs + Math.max(0, duration);
  const date = osloDate(startMs);
  if (event.allDay) {
    const last = osloDate(Math.max(startMs, endMs - 1));
    return last > date
      ? t('week.form.summaryAllDayRange', { from: longDate(date, lang), to: longDate(last, lang) })
      : t('week.form.summaryAllDay', { date: longDate(date, lang) });
  }
  return t('week.form.summaryTimed', { date: longDate(date, lang), from: osloTime(startMs), to: osloTime(endMs) });
}

function describeRepeat(event: CalendarEvent, lang: string, t: T): string {
  let rule: string;
  if (event.recurrence === 'DAILY') rule = t('week.event.repeatDaily');
  else if (event.recurrence === 'MONTHLY') rule = t('week.event.repeatMonthly');
  else if (event.recurrenceWeekdays.length) {
    // Any Monday works as an anchor for weekday names.
    // Norwegian writes weekdays in lower case mid-sentence; English capitalises them.
    const names = WEEKDAYS.filter((d) => event.recurrenceWeekdays.includes(d)).map((d) => {
      const name = longWeekday(addDays('2026-10-19', WEEKDAYS.indexOf(d)), lang);
      return lang === 'en' ? name : name.toLowerCase();
    });
    const days =
      names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('week.event.and')} ${names[names.length - 1]}` : names[0];
    rule = t('week.event.repeatWeeklyOn', { days });
  } else rule = t('week.event.repeatWeekly');
  return event.recurrenceUntil
    ? t('week.event.repeatUntil', { rule, date: formatDate(event.recurrenceUntil, lang, { day: 'numeric', month: 'long' }) })
    : rule;
}

function describeReminder(minutes: number, t: T): string {
  if (minutes === 60) return t('week.form.reminderHour');
  if (minutes === 1440) return t('week.form.reminderDay');
  return t('week.form.reminderMinutes', { count: minutes });
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editBtn: { paddingVertical: 10, minHeight: 44 },
  paper: {
    marginTop: 14,
    paddingTop: 26,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 4,
    transform: [{ rotate: '-0.6deg' }],
    shadowColor: '#1E2D32',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  magnets: { position: 'absolute', top: -14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  kicker: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.7 },
  title: { fontFamily: FontFamily.hand, fontSize: 30, lineHeight: 34 },
  when: { fontFamily: FontFamily.semiBold, fontSize: 14 },
  desc: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, paddingTop: 6 },
  chipRow: { paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  rowLabel: { fontFamily: FontFamily.semiBold, fontSize: 14.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bubble: { flex: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  commentMeta: { fontFamily: FontFamily.regular, fontSize: 12 },
  commentText: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 20 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    maxHeight: 120,
  },
});
