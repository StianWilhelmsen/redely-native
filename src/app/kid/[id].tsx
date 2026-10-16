import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { api, errorMessage, keys, type Member, type Note } from '@/api';
import { KidNote } from '@/components/magneten/family/kid-note';
import { CircleButton, Empty, Waiting } from '@/components/magneten/family/parts';
import { Magne } from '@/components/magneten/magne';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { currentMonthName, formatKroner, isThisMonth, isThisWeek, osloDate, sundayOf } from '@/lib/family-dates';
import { noteToInput, tiltFor } from '@/lib/family-notes';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

/**
 * The kid door is its own colour - a light teal - so a child (and the parent glancing
 * over) always knows they are in barnemodus. Not a theme token: nothing else uses it.
 */
const KID_DOOR = {
  light: { door: '#D6EBEC', soft: '#3E6A6E', dash: '#1A9AA6' },
  dark: { door: '#132729', soft: '#8FBDC1', dash: '#4FC2CC' },
};

export default function KidScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { memberById, household } = useHousehold();
  const child = memberById(id);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      {child ? (
        <KidDoor child={child} />
      ) : household ? (
        <View style={styles.flex}>
          <Empty pose="lurer" title={t('family.member.notFound')} />
        </View>
      ) : (
        <Waiting />
      )}
    </>
  );
}

function KidDoor({ child }: { child: Member }) {
  const { t, i18n } = useTranslation();
  const { tokens, scheme } = usePalette();
  const kid = KID_DOOR[scheme];
  const insets = useSafeAreaInsets();
  const { hid } = useHousehold();
  const { data: open, mutate: mutateOpen, error } = useSWR(keys.notes(hid), () => api.notes.list(hid));
  const { data: done, mutate: mutateDone } = useSWR(keys.notes(hid, 'done'), () =>
    api.notes.list(hid, { status: 'done' })
  );
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refresh.current) clearTimeout(refresh.current);
  }, []);

  const mine = (open ?? []).filter((n) => n.assigneeMemberId === child.id);
  const extras = (open ?? []).filter((n) => n.rewardOre && !n.assigneeMemberId);
  const left = mine.filter((n) => !ticked.has(n.id)).length;

  const earnedOre = (done ?? [])
    .filter((n) => n.assigneeMemberId === child.id && n.rewardOre && isThisMonth(n.completedAt))
    .reduce((sum, n) => sum + (n.rewardOre ?? 0), 0);

  const weekEnd = sundayOf(osloDate());
  const familyDone = (done ?? []).filter((n) => isThisWeek(n.completedAt)).length;
  const familyLeft = (open ?? []).filter((n) => n.dueDate && n.dueDate <= weekEnd).length;
  const familyTotal = familyDone + familyLeft;

  const complete = async (note: Note) => {
    setTicked((s) => new Set(s).add(note.id));
    try {
      // An extra job is up for grabs: make it the child's first, so the money is theirs.
      if (!note.assigneeMemberId) {
        await api.notes.update(hid, note.id, noteToInput(note, { assigneeMemberId: child.id }));
      }
      await api.notes.complete(hid, note.id);
      if (left <= 1 && mine.some((n) => n.id === note.id)) setTimeout(Feel.cheer, 600);
      // Let the stamp land before the note leaves the door.
      if (refresh.current) clearTimeout(refresh.current);
      refresh.current = setTimeout(() => {
        mutateOpen();
        mutateDone();
      }, 1400);
    } catch (e) {
      setTicked((s) => {
        const next = new Set(s);
        next.delete(note.id);
        return next;
      });
      Alert.alert(t('family.kid.failed'), errorMessage(e));
    }
  };

  const confirmExtra = (note: Note) => {
    Alert.alert(
      t('family.kid.extraConfirmTitle', { title: note.title }),
      t('family.kid.extraConfirmBody', { amount: formatKroner(note.rewardOre ?? 0, i18n.language) }),
      [
        { text: t('family.kid.notYet'), style: 'cancel' },
        { text: t('family.kid.didIt'), onPress: () => complete(note) },
      ]
    );
  };

  const exit = () => {
    Alert.alert(t('family.kid.exitTitle'), t('family.kid.exitBody'), [
      { text: t('actions.cancel'), style: 'cancel' },
      { text: t('family.kid.exit'), onPress: () => router.back() },
    ]);
  };

  const meta = (n: Note) => {
    const parts: string[] = [];
    if (n.dueTime) parts.push(t('family.kid.at', { time: n.dueTime }));
    if (n.rewardOre) parts.push(t('family.kid.extraJob', { amount: formatKroner(n.rewardOre, i18n.language) }));
    return parts.join(' · ') || undefined;
  };

  const paperColor = (n: Note) =>
    ({ WHITE: tokens.paper, YELLOW: tokens.paperYellow, PINK: tokens.paperPink, MINT: tokens.paperMint })[n.paper];

  // Everything on this door is the child's, so their magnet holds it all up.
  const magnet = { name: child.displayName, color: child.color, photoUrl: child.photoUrl };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: kid.door }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.header}>
        <Magne pose="jubler" size={72} />
        <View style={styles.headerText}>
          <Text style={[styles.hello, { color: tokens.text }]} accessibilityRole="header">
            {t('family.kid.hello', { name: child.displayName })}
          </Text>
          <Text style={[styles.left, { color: kid.soft }]}>
            {open ? (left > 0 ? t('family.kid.left', { count: left }) : t('family.kid.allDone')) : t('loading')}
          </Text>
        </View>
        <CircleButton icon="lock" label={t('family.kid.exitA11y')} onPress={exit} style={styles.lock} />
      </View>

      {error ? <Text style={[styles.left, { color: tokens.danger }]}>{errorMessage(error)}</Text> : null}

      <View style={styles.notes}>
        {mine.map((n) => (
          <KidNote
            key={n.id}
            title={n.title}
            meta={meta(n)}
            paper={paperColor(n)}
            tilt={tiltFor(n.id, 1.2)}
            done={ticked.has(n.id)}
            magnet={magnet}
            onTick={() => complete(n)}
          />
        ))}
        {open && mine.length === 0 ? (
          <Empty pose="sover" title={t('family.kid.empty', { name: child.displayName })} />
        ) : null}
      </View>

      {extras.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: kid.soft }]}>{t('family.kid.extraTitle').toUpperCase()}</Text>
          <View style={styles.extras}>
            {extras.map((n) => {
              const isDone = ticked.has(n.id);
              const label = t('family.kid.extraChip', {
                title: n.title,
                amount: formatKroner(n.rewardOre ?? 0, i18n.language),
              });
              return (
                <Pressable
                  key={n.id}
                  disabled={isDone}
                  onPress={() => confirmExtra(n)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDone, checked: isDone }}
                  accessibilityLabel={label}
                  style={[styles.extra, { borderColor: kid.dash, backgroundColor: tokens.paper, opacity: isDone ? 0.5 : 1 }]}>
                  <Text
                    style={[styles.extraText, { color: tokens.paperInk }, isDone && { textDecorationLine: 'line-through' }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.cards}>
        <View style={[styles.card, { backgroundColor: tokens.paper }]}>
          <Text style={[styles.cardLabel, { color: tokens.textSecondary }]}>
            {t('family.kid.earned', { month: currentMonthName(i18n.language) })}
          </Text>
          <Text style={[styles.earned, { color: tokens.stamp }]}>
            {t('family.kid.kroner', { amount: formatKroner(earnedOre, i18n.language) })}
          </Text>
          <Text style={[styles.cardSub, { color: tokens.textSecondary }]}>{t('family.kid.earnedSub')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: tokens.paperYellow }]}>
          <Text style={[styles.cardLabel, { color: tokens.paperInk }]}>{t('family.kid.goal')}</Text>
          <Text style={[styles.goalTitle, { color: tokens.paperInk }]}>{t('family.kid.goalTitle')}</Text>
          <View
            style={[styles.bar, { backgroundColor: 'rgba(27,35,38,0.15)' }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: familyTotal, now: familyDone }}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: tokens.paperInk, width: `${familyTotal ? Math.round((familyDone / familyTotal) * 100) : 0}%` },
              ]}
            />
          </View>
          <Text style={[styles.goalCount, { color: tokens.paperInk }]}>
            {t('family.kid.goalCount', { done: familyDone, count: familyTotal })}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginLeft: -10 },
  headerText: { flex: 1, paddingBottom: 10 },
  hello: { fontFamily: FontFamily.hand, fontSize: 32, lineHeight: 36 },
  left: { fontFamily: FontFamily.semiBold, fontSize: 14 },
  lock: { marginBottom: 14 },
  notes: { gap: 14 },
  section: { gap: 10 },
  sectionLabel: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.7 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extra: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  extraText: { fontFamily: FontFamily.bold, fontSize: 14 },
  cards: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, borderRadius: 16, padding: 14, gap: 4 },
  cardLabel: { fontFamily: FontFamily.bold, fontSize: 12 },
  cardSub: { fontFamily: FontFamily.regular, fontSize: 12 },
  earned: { fontFamily: FontFamily.hand, fontSize: 34, lineHeight: 40 },
  goalTitle: { fontFamily: FontFamily.hand, fontSize: 19, lineHeight: 22 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  barFill: { height: 8, borderRadius: 4 },
  goalCount: { fontFamily: FontFamily.bold, fontSize: 12 },
});
