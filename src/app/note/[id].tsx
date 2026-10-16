import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { api, ApiError, errorMessage, keys, type Comment, type Note } from '@/api';
import { ChecklistRow } from '@/components/magneten/door/checklist-row';
import { useNoteLabels } from '@/components/magneten/door/labels';
import { Icon, magnetFor, RoundButton, tint } from '@/components/magneten/door/parts';
import { Magne } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel, Settle } from '@/design/motion';
import { dateOfTimestamp, formatShortDate, formatTime, osloNow } from '@/lib/door-dates';
import { canCompleteNote, canEditNote } from '@/lib/door-notes';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const labels = useNoteLabels();
  const { hid, memberById, me, isAdult } = useHousehold();
  const { mutate: mutateGlobal } = useSWRConfig();
  const today = osloNow().date;

  const note = useSWR(keys.note(hid, id), () => api.notes.get(hid, id));
  const comments = useSWR(note.data ? keys.noteComments(hid, id) : null, () => api.notes.comments(hid, id));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const refreshLists = () => mutateGlobal((key) => Array.isArray(key) && key[0] === 'notes' && key[1] === hid);

  const n = note.data;
  const done = !!n?.completedAt;
  const stamp = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    stamp.value = done
      ? withTiming(1, { duration: reduceMotion ? 0 : 300, easing: Settle })
      : withTiming(0, { duration: reduceMotion ? 0 : 150 });
  }, [done, reduceMotion, stamp]);
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ rotate: '-12deg' }, { scale: interpolate(stamp.value, [0, 1], [1.6, 1]) }],
  }));

  if (!n) {
    const gone = note.error instanceof ApiError && note.error.status === 404;
    return (
      <View style={[styles.center, { backgroundColor: tokens.door, paddingTop: insets.top }]}>
        <Magne pose={note.error ? 'lurer' : 'trekker'} size={120} />
        <Text style={[styles.centerTitle, { color: tokens.text }]}>
          {gone ? t('door.note.gone') : note.error ? errorMessage(note.error) : t('loading')}
        </Text>
        {gone ? <Text style={[styles.centerSub, { color: tokens.textSecondary }]}>{t('door.note.goneLine')}</Text> : null}
        {note.error ? (
          <Button label={t('door.note.backToDoor')} variant="outline" onPress={() => router.back()} />
        ) : null}
      </View>
    );
  }

  const assignee = memberById(n.assigneeMemberId);
  const mayEdit = canEditNote(n, me, isAdult);
  const mayComplete = canCompleteNote(n, me, isAdult);
  const doneCount = n.checklist.filter((c) => c.done).length;
  const paperColor = { WHITE: tokens.paper, YELLOW: tokens.paperYellow, PINK: tokens.paperPink, MINT: tokens.paperMint }[n.paper];

  const toggleDone = async () => {
    const markDone = !done;
    if (markDone) Feel.done();
    const optimistic: Note = { ...n, completedAt: markDone ? new Date().toISOString() : null };
    note.mutate(optimistic, { revalidate: false });
    try {
      if (markDone) {
        const { note: saved } = await api.notes.complete(hid, n.id);
        note.mutate(saved, { revalidate: false });
      } else {
        note.mutate(await api.notes.uncomplete(hid, n.id), { revalidate: false });
      }
    } catch (e) {
      note.mutate(n, { revalidate: false });
      Alert.alert(errorMessage(e));
    } finally {
      refreshLists();
    }
  };

  const tick = async (itemId: string, value: boolean) => {
    note.mutate(
      { ...n, checklist: n.checklist.map((c) => (c.id === itemId ? { ...c, done: value } : c)) },
      { revalidate: false }
    );
    try {
      note.mutate(await api.notes.tickChecklist(hid, n.id, itemId, value), { revalidate: false });
      refreshLists();
    } catch (e) {
      note.mutate();
      Alert.alert(errorMessage(e));
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const added = await api.notes.addComment(hid, n.id, text);
      setDraft('');
      Feel.tick();
      comments.mutate((list = []) => [...list, added], { revalidate: false });
      note.mutate({ ...n, commentCount: n.commentCount + 1 }, { revalidate: false });
      refreshLists();
    } catch (e) {
      Alert.alert(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const removeComment = (c: Comment) => {
    Alert.alert(t('door.note.deleteComment'), c.text, [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: t('actions.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.comments.delete(hid, c.id);
            comments.mutate((list = []) => list.filter((x) => x.id !== c.id), { revalidate: false });
            note.mutate({ ...n, commentCount: Math.max(0, n.commentCount - 1) }, { revalidate: false });
            refreshLists();
          } catch (e) {
            Alert.alert(errorMessage(e));
          }
        },
      },
    ]);
  };

  const remove = () => {
    Alert.alert(
      t('door.note.deleteTitle'),
      n.recurrence !== 'NONE' ? t('door.note.deleteRecurring', { title: n.title }) : t('door.note.deleteBody', { title: n.title }),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('actions.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.notes.delete(hid, n.id);
              Feel.tear();
              refreshLists();
              mutateGlobal(keys.areas(hid));
              router.back();
            } catch (e) {
              Alert.alert(errorMessage(e));
            }
          },
        },
      ]
    );
  };

  const more = () =>
    Alert.alert(n.title, undefined, [
      { text: t('door.note.edit'), onPress: () => router.push({ pathname: '/note/new', params: { id: n.id } }) },
      { text: t('door.note.delete'), style: 'destructive', onPress: remove },
      { text: t('actions.cancel'), style: 'cancel' },
    ]);

  const magnet = magnetFor(assignee, tokens);
  const commentTime = (c: Comment) =>
    dateOfTimestamp(c.createdAt) === today
      ? formatTime(c.createdAt, i18n.language)
      : `${formatShortDate(dateOfTimestamp(c.createdAt), i18n.language)} ${formatTime(c.createdAt, i18n.language)}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.door }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
        <RoundButton icon="back" label={t('door.note.back')} onPress={() => router.back()} />
        {mayEdit ? <RoundButton icon="more" label={t('door.note.more')} onPress={more} /> : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.paper, { backgroundColor: paperColor }]}>
          <View style={styles.magnet} pointerEvents="none">
            <PhotoMagnet name={magnet.name} color={magnet.color} photoUrl={magnet.photoUrl} size={34} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: tokens.paperInk }]}>
            {n.title}
          </Text>
          {n.body ? <Text style={[styles.body, { color: tokens.paperInk }]}>{n.body}</Text> : null}

          <View>
            <DetailRow label={t('door.note.who')}>
              {assignee ? (
                <View style={[styles.whoChip, { backgroundColor: tint(assignee.color, 0.2) }]}>
                  <PhotoMagnet name={assignee.displayName} color={assignee.color} photoUrl={assignee.photoUrl} size={22} />
                  <Text style={[styles.whoText, { color: tokens.paperInk }]}>{assignee.displayName}</Text>
                </View>
              ) : (
                <Text style={[styles.rowValue, { color: tokens.paperInk }]}>{t('door.anyone')}</Text>
              )}
            </DetailRow>
            <DetailRow label={t('door.note.when')} value={labels.when(n, today)} />
            {n.recurrence !== 'NONE' ? (
              <DetailRow label={t('door.note.repeats')} value={labels.repeat(n.recurrence, n.recurrenceWeekdays)} />
            ) : null}
            <AreaRow hid={hid} areaId={n.areaId} label={t('door.note.area')} />
            {n.rewardOre ? <DetailRow label={t('door.note.reward')} value={labels.reward(n) ?? ''} /> : null}
            <DetailRow label={t('door.note.visibility')} value={t(`door.visibility.${n.visibility}_long`)} />
          </View>

          {n.checklist.length > 0 ? (
            <View style={[styles.checklist, { borderTopColor: tokens.border }]}>
              <Text style={[styles.checkHead, { color: tokens.textSecondary }]}>
                {t('door.note.checklist', { done: doneCount, total: n.checklist.length })}
              </Text>
              {[...n.checklist]
                .sort((a, b) => a.position - b.position)
                .map((c) => (
                  <ChecklistRow
                    key={c.id}
                    text={c.text}
                    done={c.done}
                    onToggle={mayComplete ? () => tick(c.id, !c.done) : null}
                  />
                ))}
            </View>
          ) : null}

          {done && n.completedByMemberId ? (
            <Text style={[styles.doneBy, { color: tokens.textSecondary }]}>
              {t('door.note.doneBy', { name: memberById(n.completedByMemberId)?.displayName ?? t('door.note.someone') })}
            </Text>
          ) : null}
          <Animated.Text
            pointerEvents="none"
            style={[styles.paperStamp, { color: tokens.stamp, borderColor: tokens.stamp }, stampStyle]}>
            {t('note.done')}
          </Animated.Text>
        </View>

        <View style={styles.comments}>
          {(comments.data ?? []).map((c) => {
            const author = memberById(c.memberId);
            const mine = !!me && c.memberId === me.id;
            const mag = magnetFor(author, tokens);
            return (
              <Pressable
                key={c.id}
                onLongPress={mine || isAdult ? () => removeComment(c) : undefined}
                accessibilityHint={mine || isAdult ? t('door.note.deleteCommentHint') : undefined}
                accessibilityLabel={`${author?.displayName ?? t('door.note.someone')}, ${commentTime(c)}: ${c.text}`}
                style={styles.comment}>
                <PhotoMagnet name={mag.name} color={mag.color} photoUrl={mag.photoUrl} size={32} />
                <View style={[styles.bubble, { backgroundColor: tokens.paper }]}>
                  <Text style={[styles.commentMeta, { color: tokens.textSecondary }]}>
                    {t('door.note.commentMeta', { name: author?.displayName ?? t('door.note.someone'), time: commentTime(c) })}
                  </Text>
                  <Text style={[styles.commentText, { color: tokens.text }]}>{c.text}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.inputPill, { backgroundColor: tokens.paper }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('door.note.commentPlaceholder')}
            placeholderTextColor={tokens.textSecondary}
            accessibilityLabel={t('door.note.commentPlaceholder')}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={2000}
            style={[styles.input, { color: tokens.text }]}
          />
          {draft.trim() ? (
            <Pressable
              onPress={send}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t('door.note.send')}
              style={styles.send}>
              <Icon name="send" color={tokens.text} />
            </Pressable>
          ) : null}
        </View>
        {mayComplete ? (
          <Pressable
            onPress={toggleDone}
            accessibilityRole="button"
            accessibilityLabel={done ? t('door.note.unstampLabel') : t('door.note.stampLabel')}
            accessibilityState={{ checked: done }}
            style={({ pressed }) => [
              styles.stampButton,
              {
                borderColor: tokens.stamp,
                backgroundColor: done ? tokens.stamp : tokens.paper,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.stampText, { color: done ? tokens.paper : tokens.stamp }]}>{t('note.done')}</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  const { tokens } = usePalette();
  return (
    <View style={[styles.row, { borderTopColor: tokens.border }]}>
      <Text style={[styles.rowLabel, { color: tokens.textSecondary }]}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        {children ?? <Text style={[styles.rowValue, { color: tokens.paperInk }]}>{value}</Text>}
      </View>
    </View>
  );
}

/** The area row reads the shared area list, so a renamed area shows its new name. */
function AreaRow({ hid, areaId, label }: { hid: string; areaId: string | null; label: string }) {
  const areas = useSWR(areaId ? keys.areas(hid) : null, () => api.areas.list(hid));
  const area = areas.data?.find((a) => a.id === areaId);
  if (!area) return null;
  return <DetailRow label={label} value={area.name} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerTitle: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 24, lineHeight: 35, textAlign: 'center' },
  centerSub: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, gap: 22 },
  paper: {
    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 12,
    transform: [{ rotate: '-0.6deg' }],
    shadowColor: '#1E2D32',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  magnet: { position: 'absolute', top: -17, left: 0, right: 0, alignItems: 'center' },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 30, lineHeight: 44 },
  body: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1.5, borderStyle: 'dashed', minHeight: 40 },
  rowLabel: { width: 96, fontFamily: FontFamily.regular, fontSize: 13 },
  rowValue: { fontFamily: FontFamily.semiBold, fontSize: 14 },
  whoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 3, paddingRight: 12, paddingVertical: 3, borderRadius: 999 },
  whoText: { fontFamily: FontFamily.bold, fontSize: 13 },
  checklist: { borderTopWidth: 1.5, borderStyle: 'dashed', paddingTop: 10, gap: 0 },
  checkHead: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.7 },
  doneBy: { fontFamily: FontFamily.regular, fontSize: 12.5 },
  paperStamp: {
    position: 'absolute',
    right: 14,
    top: 18,
    fontFamily: FontFamily.hand,
    fontSize: 26, lineHeight: 38,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  comments: { gap: 12 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bubble: { flexShrink: 1, borderTopLeftRadius: 4, borderTopRightRadius: 14, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingVertical: 9, paddingHorizontal: 12, gap: 2 },
  commentMeta: { fontFamily: FontFamily.bold, fontSize: 12 },
  commentText: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 19 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingLeft: 16, paddingRight: 4, minHeight: 48 },
  input: { flex: 1, fontFamily: FontFamily.regular, fontSize: 14, paddingVertical: 12 },
  send: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stampButton: { borderWidth: 2.5, borderRadius: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  stampText: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 20, lineHeight: 29 },
});
