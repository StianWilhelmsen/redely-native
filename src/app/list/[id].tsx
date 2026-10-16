import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import useSWR from 'swr';

import { api, errorMessage, keys, type ListItem } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { Notepad } from '@/components/magneten/lists/notepad';
import { LINE_HEIGHT, PenItem } from '@/components/magneten/lists/pen-item';
import { RoundButton } from '@/components/magneten/lists/round-button';
import { Sheet } from '@/components/magneten/lists/sheet';
import { Button, Chip, Field, Screen } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Durations, Feel } from '@/design/motion';
import { useListActions } from '@/lib/lists-actions';
import { listAsText } from '@/lib/lists-items';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

type Phase = 'note' | 'tearing' | 'done';

/** Handlelappen - one lined note for a shopping list or a checklist. */
export default function ListScreen() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hid, memberById, membership } = useHousehold();
  const canManage = membership.role !== 'CHILD';
  // While the note falls, a realtime refetch must not pull the ticked lines off it mid-air.
  const tearing = useRef(false);
  const { data, error, mutate } = useSWR(keys.list(hid, id), () => api.lists.get(hid, id), {
    isPaused: () => tearing.current,
  });
  const actions = useListActions(hid, id, membership.memberId);

  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<Phase>('note');
  const [removed, setRemoved] = useState(0);
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [settings, setSettings] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);
  const doneCount = items.filter((i) => i.done).length;

  // Lines that appear after the first load - ours or someone else's - write themselves in.
  // Tracked by adjusting state during render (React's pattern for "derive from a change"),
  // so nothing reads a ref while rendering.
  const [rows, setRows] = useState<{ data: typeof data; known: Set<string> | null; fresh: Set<string> }>({
    data: undefined,
    known: null,
    fresh: new Set(),
  });
  if (data && rows.data !== data) {
    const keysNow = items.map((i) => actions.rowKey(i.id));
    if (!rows.known) {
      setRows({ data, known: new Set(keysNow), fresh: rows.fresh });
    } else {
      const added = keysNow.filter((k) => !rows.known!.has(k));
      setRows({
        data,
        known: added.length ? new Set([...rows.known, ...added]) : rows.known,
        fresh: added.length ? new Set([...rows.fresh, ...added]) : rows.fresh,
      });
    }
  }

  // The counter pops each time it changes.
  const pop = useSharedValue(1);
  const lastDone = useRef<number | null>(null);
  useEffect(() => {
    if (!data) return;
    if (lastDone.current !== null && lastDone.current !== doneCount && !reduceMotion) {
      pop.set(withSequence(withTiming(1.35, { duration: 120 }), withTiming(1, { duration: 180 })));
    }
    lastDone.current = doneCount;
  }, [doneCount, data, reduceMotion, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  // Tear-off: lift, then fall away to the bottom right.
  const tear = useSharedValue(0);
  const tearStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tear.value, [0, 0.7, 1], [1, 1, 0]),
    transform: [
      { translateX: interpolate(tear.value, [0, 0.25, 1], [0, 0, 80]) },
      { translateY: interpolate(tear.value, [0, 0.25, 1], [0, -6, 620]) },
      { rotate: `${interpolate(tear.value, [0, 0.25, 1], [0.8, -3, 18])}deg` },
    ],
  }));

  if (!data) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        {error ? (
          <>
            <Magne pose="lurer" size={90} />
            <Text style={[styles.body, { color: tokens.textSecondary }]}>
              {(error as { code?: string }).code === 'list_not_found' ? t('lists.list.notFound') : errorMessage(error)}
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

  const { list } = data;
  const shopping = list.kind === 'SHOPPING';
  const me = memberById(membership.memberId);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    actions.add(text);
  };

  const finish = async () => {
    if (doneCount === 0) return Alert.alert(t('lists.list.nothingDone'));
    Feel.tear();
    tearing.current = true;
    setPhase('tearing');
    const request = actions.clearDone();
    tear.set(withTiming(1, { duration: reduceMotion ? 0 : Durations.tear, easing: Easing.bezier(0.5, 0, 0.75, 0) }));
    try {
      const [count] = await Promise.all([
        request,
        new Promise((r) => setTimeout(r, reduceMotion ? 0 : Durations.tear)),
      ]);
      tearing.current = false;
      actions.dropDone();
      setRemoved(count);
      setPhase('done');
      Feel.cheer();
    } catch (e) {
      tearing.current = false;
      tear.set(0);
      setPhase('note');
      Alert.alert(errorMessage(e));
    }
  };

  const backToNote = () => {
    tear.set(0);
    setPhase('note');
  };

  const share = () => Share.share({ message: listAsText(list.name, items) }).catch(() => {});

  return (
    <Screen>
      <View style={styles.topBar}>
        <RoundButton icon="back" label={t('actions.back')} onPress={() => router.back()} size={40} />
        <View style={{ flex: 1 }} />
        <RoundButton icon="share" label={t('lists.list.share')} onPress={share} size={40} />
        {canManage ? (
          <RoundButton icon="more" label={t('lists.list.more')} onPress={() => setSettings(true)} size={40} />
        ) : null}
      </View>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: tokens.textSecondary }]}>
            {shopping ? t('lists.list.kickerShopping') : t('lists.list.kickerChecklist')}
          </Text>
          <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
            {list.name}
          </Text>
        </View>
        {items.length ? (
          <Animated.Text
            accessibilityLiveRegion="polite"
            style={[styles.counter, { color: tokens.stamp }, popStyle]}>
            {t('lists.list.countOf', { done: doneCount, total: items.length })}
          </Animated.Text>
        ) : null}
      </View>

      {shopping ? (
        <View style={styles.chips}>
          {list.storeName ? <Chip label={t('lists.list.sortedFor', { store: list.storeName })} /> : null}
          <Chip
            label={t('lists.list.shopMode')}
            selected
            onPress={() => router.push({ pathname: '/shop/[id]', params: { id } })}
          />
        </View>
      ) : null}

      {phase === 'done' ? (
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(500)} style={styles.doneBox}>
          <Magne pose="jubler" size={130} />
          <Text style={[styles.doneTitle, { color: tokens.text }]}>
            {shopping ? t('lists.list.tornShopping') : t('lists.list.tornChecklist')}
          </Text>
          <Text style={[styles.body, { color: tokens.textSecondary }]}>{t('lists.list.tornSub', { count: removed })}</Text>
          <Button label={t('lists.list.backToList')} onPress={backToNote} style={{ marginTop: 8 }} />
        </Animated.View>
      ) : (
        <>
          <Notepad
            style={tearStyle}
            magnet={me ? { name: me.displayName, color: me.color, photoUrl: me.photoUrl } : undefined}>
            {items.length === 0 ? (
              <Text style={[styles.empty, { color: tokens.textSecondary, borderBottomColor: tokens.border }]}>
                {t('lists.list.empty')}
              </Text>
            ) : null}
            {items.map((item) => {
              const key = actions.rowKey(item.id);
              const adder = memberById(item.addedByMemberId);
              return (
                <PenItem
                  key={key}
                  text={item.text}
                  quantity={item.quantity}
                  done={item.done}
                  color={adder?.color ?? tokens.border}
                  fresh={rows.fresh.has(key)}
                  onPress={() => actions.toggle(item)}
                  onLongPress={item.id.startsWith('tmp-') ? undefined : () => setEditing(item)}
                  a11yHint={
                    [adder ? t('lists.list.addedBy', { name: adder.displayName }) : null, t('lists.list.itemHint')]
                      .filter(Boolean)
                      .join('. ')
                  }
                />
              );
            })}
            <View style={styles.addRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={shopping ? t('lists.list.addPlaceholderShopping') : t('lists.list.addPlaceholderChecklist')}
                placeholderTextColor={tokens.textSecondary}
                accessibilityLabel={shopping ? t('lists.list.addPlaceholderShopping') : t('lists.list.addPlaceholderChecklist')}
                onSubmitEditing={submit}
                submitBehavior="submit"
                returnKeyType="done"
                maxLength={200}
                style={[styles.addInput, { color: tokens.paperInk }]}
              />
              {draft.trim() ? (
                <RoundButton icon="plus" variant="ink" size={32} label={t('lists.list.add')} onPress={submit} />
              ) : null}
            </View>
          </Notepad>

          {items.length ? (
            <Button
              label={shopping ? t('lists.list.finishShopping') : t('lists.list.finishChecklist')}
              variant="outline"
              onPress={finish}
              loading={phase === 'tearing'}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </>
      )}

      <ItemSheet
        key={editing?.id ?? 'closed'}
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (editing) actions.patch(editing, input);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) actions.remove(editing);
          setEditing(null);
        }}
      />

      {canManage ? (
        <ListSettingsSheet
          key={settings ? 'open' : 'closed'}
          visible={settings}
          name={list.name}
          store={list.storeName}
          shopping={shopping}
          onClose={() => setSettings(false)}
          onSave={async (name, store) => {
            try {
              const updated = await api.lists.update(hid, id, { name, kind: list.kind, storeName: shopping ? store : null });
              mutate((cur) => (cur ? { ...cur, list: updated } : cur), { revalidate: false });
              setSettings(false);
            } catch (e) {
              Alert.alert(errorMessage(e));
            }
          }}
          onDelete={() =>
            Alert.alert(t('lists.settings.deleteTitle', { name: list.name }), t('lists.settings.deleteBody'), [
              { text: t('actions.cancel'), style: 'cancel' },
              {
                text: t('actions.delete'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.lists.delete(hid, id);
                    Feel.tear();
                    setSettings(false);
                    router.back();
                  } catch (e) {
                    Alert.alert(errorMessage(e));
                  }
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

function ItemSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ListItem | null;
  onClose: () => void;
  onSave: (input: { text: string; quantity: string; category: string }) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  // The parent remounts this sheet per item (key), so the form starts from the item.
  const [text, setText] = useState(item?.text ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? '');
  const [category, setCategory] = useState(item?.category ?? '');

  return (
    <Sheet visible={!!item} onClose={onClose} title={t('lists.item.title')}>
      <Field label={t('lists.item.text')} value={text} onChangeText={setText} maxLength={200} />
      <View style={styles.sheetRow}>
        <Field
          label={t('lists.item.quantity')}
          value={quantity}
          onChangeText={setQuantity}
          placeholder={t('lists.item.quantityPlaceholder')}
          maxLength={40}
          style={{ flex: 1 }}
        />
        <Field
          label={t('lists.item.category')}
          value={category}
          onChangeText={setCategory}
          placeholder={t('lists.item.categoryPlaceholder')}
          maxLength={60}
          style={{ flex: 1.4 }}
        />
      </View>
      <Button
        label={t('actions.save')}
        disabled={!text.trim()}
        onPress={() => onSave({ text: text.trim(), quantity: quantity.trim(), category: category.trim() })}
      />
      <Button label={t('lists.item.delete')} variant="ghost" onPress={onDelete} />
    </Sheet>
  );
}

function ListSettingsSheet({
  visible,
  name: initialName,
  store: initialStore,
  shopping,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  name: string;
  store: string | null;
  shopping: boolean;
  onClose: () => void;
  onSave: (name: string, store: string | null) => Promise<void>;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [store, setStore] = useState(initialStore ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('lists.settings.title')}>
      <Field label={t('lists.settings.name')} value={name} onChangeText={setName} maxLength={80} />
      {shopping ? (
        <Field
          label={t('lists.settings.store')}
          value={store}
          onChangeText={setStore}
          placeholder={t('lists.create.storePlaceholder')}
          maxLength={80}
        />
      ) : null}
      <Button
        label={t('actions.save')}
        loading={saving}
        disabled={!name.trim()}
        onPress={async () => {
          setSaving(true);
          await onSave(name.trim(), store.trim() || null);
          setSaving(false);
        }}
      />
      <Button label={t('lists.settings.delete')} variant="ghost" onPress={onDelete} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  kicker: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 32, lineHeight: 46 },
  counter: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 22, lineHeight: 32, paddingBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: {
    fontFamily: FontFamily.handRegular, paddingHorizontal: 3,
    fontSize: 17, lineHeight: 25,
    minHeight: LINE_HEIGHT * 2,
    textAlignVertical: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  addRow: { height: LINE_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: { flex: 1, fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 20, lineHeight: 29, paddingVertical: 0, height: LINE_HEIGHT },
  doneBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  doneTitle: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 26, lineHeight: 38, textAlign: 'center' },
  sheetRow: { flexDirection: 'row', gap: 10 },
});
