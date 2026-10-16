import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { api, errorMessage, keys, type Area, type AreaInput, type Member } from '@/api';
import { Empty, MagneLine, MagneSays, MemberChip, TopBar, Waiting } from '@/components/magneten/family/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Card, Chip, Field, Screen, SectionLabel, Title } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

/** Starter areas offered on an empty list - names and descriptions come from i18n. */
const STARTERS = ['dinner', 'clothes', 'birthdays', 'doctor', 'activities', 'bills'] as const;

type Editing = { area: Area | null; name: string; description: string; ownerMemberId: string | null };

export default function AreasScreen() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { hid, members, memberById, isAdult } = useHousehold();
  const { data: areas, error, mutate } = useSWR(keys.areas(hid), () => api.areas.list(hid));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const adults = members.filter((m) => m.role === 'ADULT');
  const count = (m: Member) => (areas ?? []).filter((a) => a.ownerMemberId === m.id).length;
  const unowned = members.length === 0 ? undefined : (areas ?? []).find((a) => !memberById(a.ownerMemberId));

  const setOwner = async (area: Area, ownerMemberId: string | null) => {
    mutate((list) => list?.map((a) => (a.id === area.id ? { ...a, ownerMemberId } : a)), { revalidate: false });
    try {
      await api.areas.update(hid, area.id, { name: area.name, description: area.description, ownerMemberId });
      Feel.snap();
      mutate();
    } catch (e) {
      mutate();
      Alert.alert(t('family.areas.failed'), errorMessage(e));
    }
  };

  const addStarter = async (key: (typeof STARTERS)[number]) => {
    setAdding(key);
    try {
      const created = await api.areas.create(hid, {
        name: t(`family.areas.starters.${key}.name`),
        description: t(`family.areas.starters.${key}.description`),
      });
      Feel.smack();
      mutate((list) => [...(list ?? []), created], { revalidate: true });
    } catch (e) {
      Alert.alert(t('family.areas.failed'), errorMessage(e));
    } finally {
      setAdding(null);
    }
  };

  if (!areas && !error) return <Waiting />;

  return (
    <Screen>
      <TopBar />
      <Title kicker={t('family.areas.kicker')} title={t('family.areas.title')} />

      {adults.length > 0 ? (
        <View style={styles.adults}>
          {adults.map((m) => (
            <View key={m.id} style={[styles.adult, { backgroundColor: tokens.paper }]}>
              <PhotoMagnet name={m.displayName} color={m.color} photoUrl={m.photoUrl} size={34} />
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={[styles.adultName, { color: tokens.text }]}>
                  {m.displayName}
                </Text>
                <Text style={[styles.sub, { color: tokens.textSecondary }]}>
                  {t('family.areas.owns', { count: count(m) })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text style={[styles.sub, { color: tokens.danger }]}>{errorMessage(error)}</Text> : null}

      {unowned ? (
        <MagneSays pose="lurer">
          <MagneLine>{t('family.areas.nobody', { name: unowned.name })}</MagneLine>
          {isAdult ? (
            <View style={styles.ownerButtons}>
              {adults.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setOwner(unowned, m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('family.areas.giveTo', { area: unowned.name, name: m.displayName })}
                  style={[styles.ownerButton, { backgroundColor: tokens.ink }]}>
                  <Text style={[styles.ownerButtonText, { color: tokens.onInk }]}>{m.displayName}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </MagneSays>
      ) : null}

      {areas && areas.length > 0 ? (
        <Card>
          {areas.map((a, i) => {
            const owner = memberById(a.ownerMemberId);
            return (
              <Pressable
                key={a.id}
                disabled={!isAdult}
                onPress={() =>
                  setEditing({ area: a, name: a.name, description: a.description ?? '', ownerMemberId: a.ownerMemberId })
                }
                accessibilityRole={isAdult ? 'button' : undefined}
                accessibilityLabel={`${a.name}, ${owner ? owner.displayName : t('family.areas.noOwner')}`}
                accessibilityHint={isAdult ? t('family.areas.editHint') : undefined}
                style={[
                  styles.areaRow,
                  i < areas.length - 1 && { borderBottomWidth: 1, borderBottomColor: tokens.backgroundSelected },
                ]}>
                <View style={styles.areaText}>
                  <Text style={[styles.areaName, { color: tokens.text }]}>{a.name}</Text>
                  {a.description || a.openNoteCount > 0 ? (
                    <Text numberOfLines={2} style={[styles.sub, { color: tokens.textSecondary }]}>
                      {[a.description, a.openNoteCount > 0 ? t('family.areas.openNotes', { count: a.openNoteCount }) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
                {owner ? (
                  <MemberChip name={owner.displayName} color={owner.color} photoUrl={owner.photoUrl} />
                ) : (
                  <View style={[styles.noOwner, { borderColor: tokens.border }]}>
                    <Text style={[styles.noOwnerText, { color: tokens.textSecondary }]}>{t('family.areas.noOwner')}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Empty title={t('family.areas.emptyTitle')}>
          <Text style={[styles.emptyBody, { color: tokens.textSecondary }]}>
            {isAdult ? t('family.areas.emptyBody') : t('family.areas.emptyBodyReadOnly')}
          </Text>
        </Empty>
      )}

      {isAdult && areas && areas.length < 3 ? (
        <>
          <SectionLabel>{t('family.areas.suggestions')}</SectionLabel>
          <View style={styles.starters}>
            {STARTERS.filter((k) => !areas.some((a) => a.name === t(`family.areas.starters.${k}.name`))).map((k) => (
              <Chip
                key={k}
                label={adding === k ? t('family.areas.adding') : `+ ${t(`family.areas.starters.${k}.name`)}`}
                onPress={adding ? undefined : () => addStarter(k)}
              />
            ))}
          </View>
        </>
      ) : null}

      {isAdult ? (
        <Button
          variant="outline"
          label={t('family.areas.new')}
          onPress={() => setEditing({ area: null, name: '', description: '', ownerMemberId: null })}
        />
      ) : null}

      <AreaEditor
        editing={editing}
        members={members}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          mutate();
        }}
        onChange={setEditing}
      />
    </Screen>
  );
}

function AreaEditor({
  editing,
  members,
  onChange,
  onClose,
  onSaved,
}: {
  editing: Editing | null;
  members: Member[];
  onChange: (e: Editing) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const { hid } = useHousehold();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing) return;
    const input: AreaInput = {
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      ownerMemberId: editing.ownerMemberId,
    };
    setBusy(true);
    try {
      if (editing.area) await api.areas.update(hid, editing.area.id, input);
      else await api.areas.create(hid, input);
      Feel.snap();
      onSaved();
    } catch (e) {
      Alert.alert(t('family.areas.failed'), errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const area = editing?.area;
    if (!area) return;
    Alert.alert(t('family.areas.deleteTitle', { name: area.name }), t('family.areas.deleteBody'), [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: t('actions.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.areas.delete(hid, area.id);
            onSaved();
          } catch (e) {
            Alert.alert(t('family.areas.failed'), errorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, backgroundColor: tokens.door }}
          contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled">
          {editing ? (
            <>
              <Title title={editing.area ? t('family.areas.editTitle') : t('family.areas.newTitle')} />
              <Field
                label={t('family.areas.name')}
                value={editing.name}
                onChangeText={(name) => onChange({ ...editing, name })}
                placeholder={t('family.areas.namePlaceholder')}
                maxLength={80}
                autoFocus={!editing.area}
              />
              <Field
                label={t('family.areas.description')}
                value={editing.description}
                onChangeText={(description) => onChange({ ...editing, description })}
                placeholder={t('family.areas.descriptionPlaceholder')}
                maxLength={1000}
                multiline
              />
              <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('family.areas.owner')}</Text>
              <View style={styles.starters}>
                <Chip
                  label={t('family.areas.noOwner')}
                  selected={editing.ownerMemberId === null}
                  onPress={() => onChange({ ...editing, ownerMemberId: null })}
                />
                {members.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.displayName}
                    member={{ name: m.displayName, color: m.color, photoUrl: m.photoUrl }}
                    selected={editing.ownerMemberId === m.id}
                    onPress={() => onChange({ ...editing, ownerMemberId: m.id })}
                  />
                ))}
              </View>
              <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('family.areas.ownerHelp')}</Text>
              <Button label={t('actions.save')} onPress={save} loading={busy} disabled={!editing.name.trim()} />
              <Button variant="ghost" label={t('actions.cancel')} onPress={onClose} />
              {editing.area ? (
                <Pressable onPress={remove} accessibilityRole="button" style={styles.danger}>
                  <Text style={[styles.dangerText, { color: tokens.danger }]}>{t('family.areas.delete')}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  adults: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  adult: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adultName: { fontFamily: FontFamily.bold, fontSize: 14 },
  sub: { fontFamily: FontFamily.regular, fontSize: 12 },
  ownerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ownerButton: { borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  ownerButtonText: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 56 },
  areaText: { flex: 1, minWidth: 0, gap: 1 },
  areaName: { fontFamily: FontFamily.bold, fontSize: 15 },
  noOwner: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  noOwnerText: { fontFamily: FontFamily.bold, fontSize: 12 },
  emptyBody: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheet: { paddingHorizontal: 18, paddingTop: 24, gap: 14 },
  label: { fontFamily: FontFamily.bold, fontSize: 13, paddingLeft: 4 },
  danger: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  dangerText: { fontFamily: FontFamily.bold, fontSize: 15 },
});
