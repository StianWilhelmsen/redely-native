import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { api, errorMessage, keys, type Note, type NoteInput, type Recurrence, type Visibility, type Weekday } from '@/api';
import { useNoteLabels } from '@/components/magneten/door/labels';
import { Icon, magnetFor, RoundButton, Segmented } from '@/components/magneten/door/parts';
import { DateChip, TimeChip } from '@/components/magneten/door/pickers';
import { Magne } from '@/components/magneten/magne';
import type { Paper } from '@/components/magneten/note';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Chip } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { addDays, formatKr, intlLocale, osloNow, parseKr, WEEK_ORDER, weekdayOf } from '@/lib/door-dates';
import { paperDtoOf, paperOf } from '@/lib/door-notes';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

type ChecklistDraft = { key: string; id: string | null; text: string };

const PAPERS: Paper[] = ['white', 'yellow', 'pink', 'mint'];
const REPEATS: Recurrence[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

let draftKey = 0;
const nextKey = () => `d${(draftKey += 1)}`;

export default function NoteFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const labels = useNoteLabels();
  const { hid, members, memberById, membership, isAdult } = useHousehold();
  const { mutate } = useSWRConfig();
  const today = osloNow().date;

  const existing = useSWR(editing ? keys.note(hid, id!) : null, () => api.notes.get(hid, id!));
  const areas = useSWR(keys.areas(hid), () => api.areas.list(hid));

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>('NONE');
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [paper, setPaper] = useState<Paper>('white');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('ALL');
  const [rewardKr, setRewardKr] = useState('');
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  // Fill the form from the note being edited, once.
  const filled = useRef(false);
  useEffect(() => {
    const n: Note | undefined = existing.data;
    if (!n || filled.current) return;
    filled.current = true;
    setTitle(n.title);
    setBody(n.body ?? '');
    setAssignee(n.assigneeMemberId);
    setDueDate(n.dueDate);
    setDueTime(n.dueTime);
    setRecurrence(n.recurrence);
    setWeekdays(n.recurrenceWeekdays);
    setPaper(paperOf(n.paper));
    setAreaId(n.areaId);
    setVisibility(n.visibility);
    setRewardKr(n.rewardOre ? formatKr(n.rewardOre, i18n.language) : '');
    setChecklist(n.checklist.map((c) => ({ key: c.id, id: c.id, text: c.text })));
  }, [existing.data, i18n.language]);

  const assigneeMember = memberById(assignee);
  const hasChildren = members.some((m) => m.role === 'CHILD');
  const showReward = assigneeMember ? assigneeMember.role === 'CHILD' : hasChildren;
  const canEvent = membership.role !== 'CHILD';
  const paperColor = { white: tokens.paper, yellow: tokens.paperYellow, pink: tokens.paperPink, mint: tokens.paperMint };

  const whenSummary = useMemo(() => {
    const parts = [];
    if (dueDate) parts.push(dueTime ? `${labels.dayWord(dueDate, today)} ${dueTime}` : labels.dayWord(dueDate, today));
    if (recurrence !== 'NONE') {
      parts.push(labels.repeat(recurrence, weekdays));
    }
    return parts.join(' · ');
  }, [dueDate, dueTime, recurrence, weekdays, labels, today]);

  const pickRepeat = (r: Recurrence) => {
    setRecurrence(r);
    // A repeating note needs a first day; start today unless one is picked.
    const start = dueDate ?? today;
    if (r !== 'NONE' && !dueDate) setDueDate(start);
    if (r === 'WEEKLY' && weekdays.length === 0) setWeekdays([weekdayOf(start)]);
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    Feel.tick();
    setChecklist((list) => [...list, { key: nextKey(), id: null, text }]);
    setNewItem('');
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert(t('door.form.titleRequired'));
      return;
    }
    const date = dueDate ?? (dueTime || recurrence !== 'NONE' ? today : null);
    const pendingItem = newItem.trim();
    const items = [...checklist, ...(pendingItem ? [{ key: 'pending', id: null, text: pendingItem }] : [])]
      .map((c) => ({ id: c.id, text: c.text.trim(), done: c.id ? null : false }))
      .filter((c) => c.text);
    const input: NoteInput = {
      title: trimmed,
      body: body.trim() || null,
      dueDate: date,
      dueTime: date ? dueTime : null,
      recurrence,
      recurrenceWeekdays: recurrence === 'WEEKLY' ? weekdays : [],
      assigneeMemberId: assignee,
      areaId,
      visibility,
      paper: paperDtoOf(paper),
      rewardOre: showReward ? parseKr(rewardKr) : null,
      checklist: items,
    };
    setSaving(true);
    try {
      const saved = editing ? await api.notes.update(hid, id!, input) : await api.notes.create(hid, input);
      Feel.smack();
      mutate(keys.note(hid, saved.id), saved, { revalidate: false });
      mutate((key) => Array.isArray(key) && key[0] === 'notes' && key[1] === hid);
      if (areaId || existing.data?.areaId) mutate(keys.areas(hid));
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
      setSaving(false);
    }
  };

  if (editing && !existing.data) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.door }]}>
        <Magne pose={existing.error ? 'lurer' : 'trekker'} size={110} />
        <Text style={[styles.centerText, { color: tokens.text }]}>
          {existing.error ? errorMessage(existing.error) : t('loading')}
        </Text>
        <Button label={t('actions.close')} variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const magnet = magnetFor(assigneeMember, tokens);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.door }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 20 : insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          {editing ? (
            <Text accessibilityRole="header" style={[styles.formTitle, { color: tokens.text }]}>
              {t('door.form.editTitle')}
            </Text>
          ) : canEvent ? (
            <Segmented
              label={t('door.form.kindLabel')}
              value="note"
              onChange={(v) => v === 'event' && router.replace('/event/new')}
              options={[
                { value: 'note', label: t('door.form.kindNote') },
                { value: 'event', label: t('door.form.kindEvent') },
              ]}
            />
          ) : (
            <Text accessibilityRole="header" style={[styles.formTitle, { color: tokens.text }]}>
              {t('door.form.newTitle')}
            </Text>
          )}
          <RoundButton icon="close" label={t('door.form.close')} onPress={() => router.back()} />
        </View>

        {/* The note itself, on its own paper. */}
        <View style={[styles.paper, { backgroundColor: paperColor[paper] }]}>
          <View style={styles.paperMagnet} pointerEvents="none">
            <PhotoMagnet name={magnet.name} color={magnet.color} photoUrl={magnet.photoUrl} size={30} />
          </View>
          <Text style={[styles.paperLabel, { color: tokens.textSecondary }]}>{t('door.form.what')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('door.form.titlePlaceholder')}
            placeholderTextColor={tokens.textSecondary}
            accessibilityLabel={t('door.form.what')}
            autoFocus={!editing}
            maxLength={200}
            multiline
            blurOnSubmit
            returnKeyType="done"
            style={[styles.titleInput, { color: tokens.paperInk, borderBottomColor: tokens.paperInk }]}
          />
          {whenSummary ? <Text style={[styles.paperSub, { color: tokens.textSecondary }]}>{whenSummary}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: tokens.paper }]}>
          <Section label={t('door.form.who')}>
            <View style={styles.wrap}>
              <Chip label={t('door.nobody')} selected={!assignee} onPress={() => setAssignee(null)} />
              {members.map((m) => (
                <Chip
                  key={m.id}
                  label={m.displayName}
                  selected={assignee === m.id}
                  onPress={() => setAssignee(m.id)}
                  member={{ name: m.displayName, color: m.color, photoUrl: m.photoUrl }}
                />
              ))}
            </View>
          </Section>

          <Section label={t('door.form.when')}>
            <View style={styles.wrap}>
              <Chip
                label={t('door.form.noDate')}
                selected={!dueDate}
                onPress={() => {
                  setDueDate(null);
                  setDueTime(null);
                  setRecurrence('NONE');
                }}
              />
              <Chip label={t('door.form.today')} selected={dueDate === today} onPress={() => setDueDate(today)} />
              <Chip
                label={t('door.form.tomorrow')}
                selected={dueDate === addDays(today, 1)}
                onPress={() => setDueDate(addDays(today, 1))}
              />
              <DateChip
                label={
                  dueDate && dueDate !== today && dueDate !== addDays(today, 1)
                    ? labels.dayWord(dueDate, today)
                    : t('door.form.pickDate')
                }
                selected={!!dueDate && dueDate !== today && dueDate !== addDays(today, 1)}
                value={dueDate}
                minimum={dueDate && dueDate < today ? dueDate : today}
                onChange={setDueDate}
                locale={intlLocale(i18n.language)}
              />
            </View>
            {dueDate ? (
              <View style={styles.wrap}>
                <Chip label={t('door.form.noTime')} selected={!dueTime} onPress={() => setDueTime(null)} />
                <TimeChip
                  label={dueTime ?? t('door.form.pickTime')}
                  selected={!!dueTime}
                  value={dueTime}
                  onChange={setDueTime}
                  locale={intlLocale(i18n.language)}
                />
              </View>
            ) : null}
          </Section>

          <Section label={t('door.form.repeat')}>
            <View style={styles.wrap}>
              {REPEATS.map((r) => (
                <Chip key={r} label={t(`door.repeat.${r}`)} selected={recurrence === r} onPress={() => pickRepeat(r)} />
              ))}
            </View>
            {recurrence === 'WEEKLY' ? (
              <View style={styles.wrap} accessibilityLabel={t('door.form.weekdays')}>
                {WEEK_ORDER.map((d) => (
                  <Chip
                    key={d}
                    label={t(`door.weekdayShort.${d}`)}
                    selected={weekdays.includes(d)}
                    onPress={() =>
                      setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
                    }
                  />
                ))}
              </View>
            ) : null}
          </Section>

          <Section label={t('door.form.paper')}>
            <View style={styles.wrap}>
              {PAPERS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => {
                    Feel.tick();
                    setPaper(p);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={t(`door.form.paperName.${p}`)}
                  accessibilityState={{ selected: paper === p }}
                  style={[
                    styles.swatch,
                    { backgroundColor: paperColor[p], borderColor: paper === p ? tokens.text : tokens.border },
                  ]}
                />
              ))}
            </View>
          </Section>

          {areas.data && areas.data.length > 0 ? (
            <Section label={t('door.form.area')}>
              <View style={styles.wrap}>
                <Chip label={t('door.nobody')} selected={!areaId} onPress={() => setAreaId(null)} />
                {areas.data.map((a) => (
                  <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => setAreaId(a.id)} />
                ))}
              </View>
            </Section>
          ) : null}

          <Section label={t('door.form.visibility')}>
            <Segmented
              stretch
              label={t('door.form.visibility')}
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: 'ALL', label: t('door.visibility.ALL_long') },
                { value: 'ADULTS', label: t('door.visibility.ADULTS'), disabled: !isAdult },
                { value: 'PRIVATE', label: t('door.visibility.PRIVATE') },
              ]}
            />
          </Section>

          {showReward ? (
            <Section label={t('door.form.reward')} hint={t('door.form.rewardHint')}>
              <View style={[styles.krRow, { borderColor: tokens.border }]}>
                <TextInput
                  value={rewardKr}
                  onChangeText={(v) => setRewardKr(v.replace(/[^0-9.,]/g, ''))}
                  placeholder={t('door.form.rewardPlaceholder')}
                  placeholderTextColor={tokens.textSecondary}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('door.form.reward')}
                  maxLength={7}
                  style={[styles.krInput, { color: tokens.text }]}
                />
                <Text style={[styles.kr, { color: tokens.textSecondary }]}>{t('door.form.kr')}</Text>
              </View>
            </Section>
          ) : null}

          <Section label={t('door.form.checklist')}>
            {checklist.map((c) => (
              <View key={c.key} style={styles.itemRow}>
                <View style={[styles.box, { borderColor: tokens.text }]} />
                <TextInput
                  value={c.text}
                  onChangeText={(text) => setChecklist((list) => list.map((x) => (x.key === c.key ? { ...x, text } : x)))}
                  accessibilityLabel={c.text}
                  maxLength={200}
                  style={[styles.itemInput, { color: tokens.text }]}
                />
                <Pressable
                  onPress={() => setChecklist((list) => list.filter((x) => x.key !== c.key))}
                  accessibilityRole="button"
                  accessibilityLabel={t('door.form.checklistRemove', { text: c.text })}
                  hitSlop={8}
                  style={styles.itemRemove}>
                  <Icon name="close" color={tokens.textSecondary} size={16} />
                </Pressable>
              </View>
            ))}
            {checklist.length < 50 ? (
              <View style={styles.itemRow}>
                <Icon name="plus" color={tokens.textSecondary} size={18} />
                <TextInput
                  value={newItem}
                  onChangeText={setNewItem}
                  onSubmitEditing={addItem}
                  placeholder={t('door.form.checklistPlaceholder')}
                  placeholderTextColor={tokens.textSecondary}
                  accessibilityLabel={t('door.form.checklistAdd')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  maxLength={200}
                  style={[styles.itemInput, { color: tokens.text }]}
                />
              </View>
            ) : null}
          </Section>

          <Section label={t('door.form.body')} last>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t('door.form.bodyPlaceholder')}
              placeholderTextColor={tokens.textSecondary}
              accessibilityLabel={t('door.form.body')}
              multiline
              maxLength={4000}
              style={[styles.bodyInput, { color: tokens.text }]}
            />
          </Section>
        </View>

        <Button label={editing ? t('door.form.saveEdit') : t('door.form.save')} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ label, hint, children, last }: { label: string; hint?: string; children: ReactNode; last?: boolean }) {
  const { tokens } = usePalette();
  return (
    <View style={[styles.section, !last && { borderBottomWidth: 1, borderBottomColor: tokens.backgroundSelected }]}>
      <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>{label}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: tokens.textSecondary }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centerText: { fontFamily: FontFamily.hand, fontSize: 20, textAlign: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  formTitle: { fontFamily: FontFamily.hand, fontSize: 28 },
  paper: {
    marginTop: 8,
    paddingTop: 26,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 4,
    transform: [{ rotate: '0.6deg' }],
    shadowColor: '#1E2D32',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  paperMagnet: { position: 'absolute', top: -14, left: 0, right: 0, alignItems: 'center' },
  paperLabel: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.7 },
  titleInput: { fontFamily: FontFamily.hand, fontSize: 28, lineHeight: 34, paddingVertical: 2, borderBottomWidth: 2 },
  paperSub: { fontFamily: FontFamily.regular, fontSize: 13, paddingTop: 6 },
  card: { borderRadius: 16, paddingHorizontal: 14 },
  section: { gap: 8, paddingVertical: 12 },
  sectionLabel: { fontFamily: FontFamily.regular, fontSize: 13 },
  sectionHint: { fontFamily: FontFamily.regular, fontSize: 12, marginTop: -6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 44, height: 44, borderRadius: 8, borderWidth: 2.5 },
  krRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 14, paddingHorizontal: 14, alignSelf: 'flex-start', minWidth: 140 },
  krInput: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: 18, paddingVertical: 10 },
  kr: { fontFamily: FontFamily.bold, fontSize: 15 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2 },
  itemInput: { flex: 1, fontFamily: FontFamily.handRegular, fontSize: 18, paddingVertical: 6 },
  itemRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bodyInput: { fontFamily: FontFamily.regular, fontSize: 15, minHeight: 60, textAlignVertical: 'top' },
});
