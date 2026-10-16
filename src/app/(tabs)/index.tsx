import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { api, errorMessage, keys, type Note } from '@/api';
import { DoorNote } from '@/components/magneten/door/door-note';
import { useNoteLabels } from '@/components/magneten/door/labels';
import { NextUpCard } from '@/components/magneten/door/next-up';
import { Icon, magnetFor, RoundButton } from '@/components/magneten/door/parts';
import { Magne, type MagnePose } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { TAB_BAR_SPACE } from '@/components/magneten/tab-bar';
import { Button } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Durations, Feel } from '@/design/motion';
import { formatLongDate, noteTilt, osloNow } from '@/lib/door-dates';
import { buildDoor, canCompleteNote, paperOf, pickNextUp } from '@/lib/door-notes';
import { useHousehold } from '@/state/household';
import { useHouseholdEvent } from '@/state/household-socket';
import { usePalette } from '@/theme/palette-context';

/** More than this and the door folds the rest behind "Se alle". */
const DOOR_CAP = 8;

/** Oslo "now", ticking every 30 s so "om 40 min" and "today" stay true. */
function useOsloNow() {
  const [now, setNow] = useState(() => osloNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(osloNow()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function DoorScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const labels = useNoteLabels();
  const { hid, members, memberById, me, isAdult } = useHousehold();
  const { mutate: mutateGlobal } = useSWRConfig();
  const now = useOsloNow();
  const today = now.date;

  const open = useSWR(keys.notes(hid), () => api.notes.list(hid));
  const done = useSWR(keys.notes(hid, 'door-done'), () => api.notes.list(hid, { status: 'done' }));
  const areas = useSWR(keys.areas(hid), () => api.areas.list(hid));
  const events = useSWR(keys.events(hid, today, today), () => api.events.range(hid, today, today));
  const activity = useSWR(keys.activity(hid), () => api.activity.page(hid));

  // Taps show at once; the server's answer replaces this when it lands.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const door = useMemo(
    () => buildDoor(open.data ?? [], done.data ?? [], today),
    [open.data, done.data, today]
  );
  const isDone = useCallback(
    (n: Note) => (n.id in pending ? pending[n.id] : !!n.completedAt),
    [pending]
  );

  const nextUp = useMemo(
    () => pickNextUp(open.data ?? [], events.data ?? [], today, now.minutes),
    [open.data, events.data, today, now.minutes]
  );
  const grid = door.filter((n) => !(nextUp?.kind === 'note' && nextUp.note.id === n.id));
  const visible = expanded ? grid : grid.slice(0, DOOR_CAP);
  const left = door.filter((n) => !isDone(n)).length;
  const allDone = door.length > 0 && left === 0;

  // ---- New notes smack onto the door -------------------------------------------------
  const seen = useRef<Set<string> | null>(null);
  const announced = useRef(new Set<string>());
  const [smackIds, setSmackIds] = useState<Set<string>>(new Set());
  const [smacking, setSmacking] = useState(false);
  const [smackKey, setSmackKey] = useState(0);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);

  // Someone else hung a note up: make sure it smacks even if it was quick to arrive.
  useHouseholdEvent('NOTE_CHANGED', (e) => {
    if (seen.current && !seen.current.has(e.entityId)) announced.current.add(e.entityId);
  });

  useEffect(() => {
    if (!open.data || !done.data) return;
    const ids = [...open.data, ...done.data].map((n) => n.id);
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const doorIds = new Set(door.map((n) => n.id));
    const fresh = ids.filter((id) => !seen.current!.has(id) && (doorIds.has(id) || announced.current.has(id)));
    ids.forEach((id) => seen.current!.add(id));
    const landing = fresh.filter((id) => doorIds.has(id));
    if (landing.length === 0) return;
    landing.forEach((id) => announced.current.delete(id));
    setSmackIds((prev) => new Set([...prev, ...landing]));
    setSmacking(true);
    setSmackKey((k) => k + 1);
    if (!reduceMotion) {
      const land = Durations.smack * 0.55;
      shakeX.value = withDelay(
        land,
        withSequence(
          withTiming(1.5, { duration: 45 }),
          withTiming(-1.5, { duration: 45 }),
          withTiming(1, { duration: 45 }),
          withTiming(0, { duration: 60 })
        )
      );
      shakeY.value = withDelay(
        land,
        withSequence(withTiming(1, { duration: 45 }), withTiming(-1, { duration: 45 }), withTiming(0, { duration: 105 }))
      );
    }
  }, [open.data, done.data, door, reduceMotion, shakeX, shakeY]);

  useEffect(() => {
    if (!smacking) return;
    const timer = setTimeout(() => setSmacking(false), 1800);
    return () => clearTimeout(timer);
  }, [smacking, smackKey]);

  const doorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: shakeY.value }],
  }));

  // ---- Ticking notes off -------------------------------------------------------------
  const toggle = async (note: Note) => {
    const markDone = !isDone(note);
    setPending((p) => ({ ...p, [note.id]: markDone }));
    if (markDone && door.every((n) => n.id === note.id || isDone(n))) Feel.cheer();
    try {
      if (markDone) {
        const { note: saved, next } = await api.notes.complete(hid, note.id);
        await open.mutate(
          (list = []) => [...list.filter((n) => n.id !== note.id), ...(next ? [next] : [])],
          { revalidate: false }
        );
        await done.mutate((list = []) => [saved, ...list.filter((n) => n.id !== note.id)], { revalidate: false });
        mutateGlobal(keys.note(hid, note.id), saved, { revalidate: false });
      } else {
        const saved = await api.notes.uncomplete(hid, note.id);
        await done.mutate((list = []) => list.filter((n) => n.id !== note.id), { revalidate: false });
        await open.mutate((list = []) => [...list.filter((n) => n.id !== note.id), saved], { revalidate: false });
        mutateGlobal(keys.note(hid, note.id), saved, { revalidate: false });
      }
    } catch (e) {
      Alert.alert(errorMessage(e));
    } finally {
      setPending((p) => {
        const rest = { ...p };
        delete rest[note.id];
        return rest;
      });
      open.mutate();
      done.mutate();
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([open.mutate(), done.mutate(), events.mutate(), activity.mutate(), areas.mutate()]);
    setRefreshing(false);
  };

  const openNote = (id: string) => router.push({ pathname: '/note/[id]', params: { id } });
  const newNote = () => router.push('/note/new');

  // ---- Header ------------------------------------------------------------------------
  const pose: MagnePose = smacking ? 'smack' : allDone ? 'jubler' : door.length === 0 ? 'sover' : 'glad';
  const headline = door.length === 0
    ? t('door.emptyTitle')
    : allDone
      ? t('door.allDone')
      : left === 1
        ? t('door.leftOne')
        : t('door.leftMany', { count: left });
  const unseen = activity.data?.unseenCount ?? 0;
  const loading = !open.data && !open.error;

  const header = (
    <View style={styles.header}>
      {door.length > 0 || loading ? <Magne pose={loading ? 'trekker' : pose} size={64} playKey={smackKey} /> : null}
      <View style={styles.headText}>
        <Text style={[styles.date, { color: tokens.textSecondary }]}>{formatLongDate(today, i18n.language)}</Text>
        <Text style={[styles.headline, { color: tokens.text }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {loading ? t('loading') : headline}
        </Text>
      </View>
      <View style={styles.headRight}>
        <RoundButton
          icon="bell"
          label={unseen ? t('door.bellUnseen', { count: unseen }) : t('door.bell')}
          badge={unseen}
          onPress={() => router.push('/activity')}
        />
        {members.length > 0 ? (
          <Pressable
            onPress={() => router.push('/family')}
            accessibilityRole="button"
            accessibilityLabel={`${t('door.family')}: ${members.map((m) => m.displayName).join(', ')}`}
            accessibilityHint={t('door.familyHint')}
            hitSlop={8}
            style={styles.stack}>
            {members.slice(0, 5).map((m, i) => (
              <View key={m.id} style={i > 0 && { marginLeft: -9 }}>
                <PhotoMagnet name={m.displayName} color={m.color} photoUrl={m.photoUrl} size={30} />
              </View>
            ))}
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  let nextUpCard = null;
  if (nextUp?.kind === 'note') {
    const n = nextUp.note;
    const who = memberById(n.assigneeMemberId);
    nextUpCard = (
      <NextUpCard
        minutesAway={nextUp.minutesAway}
        time={nextUp.time}
        title={n.title}
        line={[who?.displayName ?? t('door.anyone'), n.body?.split('\n')[0]].filter(Boolean).join(' · ')}
        member={magnetFor(who, tokens)}
        onPress={() => openNote(n.id)}
      />
    );
  } else if (nextUp?.kind === 'event') {
    const ev = nextUp.occurrence.event;
    const people = [ev.driverMemberId, ...ev.memberIds].filter((id, i, all) => id && all.indexOf(id) === i);
    const first = memberById(people[0]);
    const names = people.map((id) => memberById(id)?.displayName).filter(Boolean) as string[];
    nextUpCard = (
      <NextUpCard
        minutesAway={nextUp.minutesAway}
        time={nextUp.time}
        title={ev.title}
        line={[names.join(', '), ev.location].filter(Boolean).join(' · ')}
        member={magnetFor(first, tokens)}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: ev.id } })}
      />
    );
  }

  let body;
  if (loading) {
    body = null;
  } else if (!open.data) {
    body = (
      <View style={styles.center}>
        <Magne pose="lurer" size={110} />
        <Text style={[styles.centerLine, { color: tokens.text }]}>{t('door.loadError')}</Text>
        <Text style={[styles.centerSub, { color: tokens.textSecondary }]}>{errorMessage(open.error)}</Text>
        <Button label={t('actions.retry')} variant="outline" onPress={() => open.mutate()} />
      </View>
    );
  } else if (door.length === 0) {
    body = (
      <View style={styles.center}>
        <View style={styles.emptyStage}>
          <View style={[styles.ghost, styles.ghostLeft, { backgroundColor: tokens.paper }]} />
          <View style={[styles.ghost, styles.ghostRight, { backgroundColor: tokens.paperYellow }]} />
          <Magne pose="sover" size={150} />
        </View>
        <Text style={[styles.centerLine, { color: tokens.text }]}>{t('door.emptyLine')}</Text>
        <Text style={[styles.centerSub, { color: tokens.textSecondary }]}>{t('door.emptyHint')}</Text>
        <Button label={t('door.newNote')} variant="magne" onPress={newNote} style={{ alignSelf: 'center', paddingHorizontal: 28 }} />
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.grid}>
          {visible.map((n) => {
            const who = memberById(n.assigneeMemberId);
            const area = areas.data?.find((a) => a.id === n.areaId);
            const allowed = canCompleteNote(n, me, isAdult);
            return (
              <DoorNote
                key={n.id}
                style={styles.cell}
                title={n.title}
                meta={labels.meta(n, today)}
                footer={labels.footer(n, who, area)}
                member={magnetFor(who, tokens)}
                paper={paperOf(n.paper)}
                tilt={noteTilt(n.id)}
                done={isDone(n)}
                smackIn={smackIds.has(n.id)}
                onToggle={allowed ? () => toggle(n) : null}
                onBlocked={() => Alert.alert(t('door.notAllowed'))}
                onOpen={() => openNote(n.id)}
              />
            );
          })}
        </View>
        {grid.length > DOOR_CAP ? (
          <Button
            variant="ghost"
            label={expanded ? t('door.seeFewer') : t('door.seeAll', { count: grid.length })}
            onPress={() => setExpanded((x) => !x)}
          />
        ) : null}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.door }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_SPACE + insets.bottom + 72 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={tokens.textSecondary}
            accessibilityLabel={t('door.refresh')}
          />
        }>
        {header}
        <Animated.View style={[styles.door, doorStyle]}>
          {nextUpCard}
          {body}
        </Animated.View>
      </ScrollView>
      {door.length > 0 ? (
        <Pressable
          onPress={newNote}
          accessibilityRole="button"
          accessibilityLabel={t('door.newNote')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: tokens.magne, shadowColor: tokens.magne, bottom: TAB_BAR_SPACE + insets.bottom - 8, opacity: pressed ? 0.9 : 1 },
          ]}>
          <Icon name="plus" color="#FFFFFF" size={26} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginLeft: -6 },
  headText: { flex: 1, minWidth: 0, paddingBottom: 6 },
  date: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  headline: { fontFamily: FontFamily.hand, fontSize: 26, lineHeight: 30 },
  headRight: { alignItems: 'flex-end', gap: 8, paddingBottom: 6 },
  stack: { flexDirection: 'row', minHeight: 44, alignItems: 'center' },
  door: { gap: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  cell: { width: '47.5%' },
  center: { alignItems: 'center', gap: 10, paddingTop: 32, paddingHorizontal: 12 },
  centerLine: { fontFamily: FontFamily.hand, fontSize: 24, lineHeight: 29, textAlign: 'center' },
  centerSub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  emptyStage: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 70 },
  ghost: { position: 'absolute', opacity: 0.5 },
  ghostLeft: { left: 0, top: 40, width: 54, height: 42, transform: [{ rotate: '-8deg' }] },
  ghostRight: { right: 4, top: 70, width: 46, height: 38, transform: [{ rotate: '10deg' }] },
  fab: {
    position: 'absolute',
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
