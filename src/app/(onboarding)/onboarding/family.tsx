import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInRight, FadeOut } from 'react-native-reanimated';

import { api, errorMessage } from '@/api';
import {
  getDraft,
  HOME_CHOICE_TYPE,
  nextFreeColor,
  updateDraft,
  type DraftPerson,
} from '@/components/magneten/onboarding/draft';
import { BackButton, ErrorText, Spacer, StepDots } from '@/components/magneten/onboarding/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Card, Field, Screen } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { forgetProviderName } from '@/lib/provider-profile';
import { useMeState } from '@/state/household';
import { setOnboardingActive } from '@/state/onboarding-flag';
import { usePalette } from '@/theme/palette-context';

const THIS_YEAR = new Date().getFullYear();

/**
 * Step 3: the people you live with. Adults are only named here (they get the invitation
 * in step 4); children become profiles without a login. "Neste" creates the household.
 */
/** Local keys for people not yet saved to the server. */
let nextKey = 0;
function newKey() {
  nextKey += 1;
  return `p${nextKey}`;
}

export default function FamilyStep() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { mutateMe, switchHousehold } = useMeState();
  const draft = getDraft();
  const withKids = draft.choice === 'family' || draft.choice === 'twoHomes';

  const [people, setPeople] = useState<DraftPerson[]>(draft.people);
  const [adding, setAdding] = useState<'ADULT' | 'CHILD' | null>(null);
  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (next: DraftPerson[]) => {
    setPeople(next);
    updateDraft({ people: next });
  };

  const openForm = (role: 'ADULT' | 'CHILD') => {
    setAdding(role);
    setNewName('');
    setNewYear('');
    setFormError(null);
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return setFormError(t('onboarding.family.nameMissing'));
    let birthYear: number | null = null;
    if (adding === 'CHILD') {
      const year = Number(newYear);
      if (!Number.isInteger(year) || year < 1900 || year > THIS_YEAR) {
        return setFormError(t('onboarding.family.birthYearInvalid'));
      }
      birthYear = year;
    }
    const color = nextFreeColor([draft.color, ...people.map((p) => p.color)]);
    save([...people, { key: newKey(), name, role: adding!, birthYear, color }]);
    setAdding(null);
  };

  const remove = (key: string) => save(people.filter((p) => p.key !== key || !!p.memberId));

  const next = async () => {
    setBusy(true);
    setError(null);
    // Before the household exists, so the guard keeps us here once it does.
    setOnboardingActive(true);
    try {
      const d = getDraft();
      let hid = d.createdHid;
      let myMemberId = d.myMemberId;
      if (!hid || !myMemberId) {
        const household = await api.households.create({
          name: d.homeName,
          type: HOME_CHOICE_TYPE[d.choice],
          displayName: d.name,
          color: d.color,
        });
        hid = household.id;
        myMemberId = household.myMemberId;
        updateDraft({ createdHid: hid, myMemberId });
        switchHousehold(hid);
      }

      if (d.photo && !d.photoUploaded) {
        try {
          await api.members.uploadPhoto(hid, myMemberId, d.photo);
          updateDraft({ photoUploaded: true });
        } catch (e) {
          // A photo is a nicety; the door works without it and it can be added from Meg.
          console.warn('[onboarding] photo upload failed', e);
        }
      }

      const list = [...getDraft().people];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.role !== 'CHILD' || p.memberId) continue;
        const member = await api.members.add(hid, {
          displayName: p.name,
          role: 'CHILD',
          birthYear: p.birthYear,
          color: p.color,
        });
        list[i] = { ...p, memberId: member.id };
        updateDraft({ people: list });
      }
      setPeople(list);

      await mutateMe();
      forgetProviderName().catch(() => {});
      router.push('/onboarding/invite');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton />
        <View style={styles.dots}>
          <StepDots step={3} />
        </View>
        <View style={styles.backSpace} />
      </View>

      <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
        {t('onboarding.family.title')}
      </Text>
      <Text style={[styles.sub, { color: tokens.textSecondary }]}>
        {withKids ? t('onboarding.family.sub') : t('onboarding.family.subAdults')}
      </Text>

      <View style={styles.list}>
        <PersonRow
          magnet={<PhotoMagnet name={draft.name} color={draft.color} photoUrl={draft.photo?.uri} size={44} />}
          title={t('onboarding.family.me', { name: draft.name })}
          sub={t('onboarding.family.meSub')}
          role={t('onboarding.family.adult')}
        />
        {people.map((p) => (
          <Animated.View key={p.key} entering={FadeInRight.duration(480)} exiting={FadeOut.duration(160)}>
            <PersonRow
              magnet={<PhotoMagnet name={p.name} color={p.color} size={44} snapIn />}
              title={
                p.role === 'CHILD' && p.birthYear
                  ? t('onboarding.family.childAge', { name: p.name, age: THIS_YEAR - p.birthYear })
                  : p.name
              }
              sub={p.role === 'CHILD' ? t('onboarding.family.childSub') : t('onboarding.family.adultSub')}
              role={p.role === 'CHILD' ? t('onboarding.family.child') : t('onboarding.family.adult')}
              onRemove={p.memberId ? undefined : () => remove(p.key)}
              removeLabel={t('onboarding.family.remove', { name: p.name })}
            />
          </Animated.View>
        ))}
      </View>

      {adding ? (
        <Card style={styles.form}>
          <Text style={[styles.formTitle, { color: tokens.text }]}>
            {adding === 'CHILD' ? t('onboarding.family.newChild') : t('onboarding.family.newAdult')}
          </Text>
          <Field
            label={t('onboarding.family.name')}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            maxLength={80}
            returnKeyType={adding === 'CHILD' ? 'next' : 'done'}
            onSubmitEditing={adding === 'CHILD' ? undefined : add}
          />
          {adding === 'CHILD' ? (
            <Field
              label={t('onboarding.family.birthYear')}
              value={newYear}
              onChangeText={(v) => setNewYear(v.replace(/\D/g, '').slice(0, 4))}
              placeholder={t('onboarding.family.birthYearPlaceholder')}
              keyboardType="number-pad"
              onSubmitEditing={add}
            />
          ) : null}
          <ErrorText>{formError}</ErrorText>
          <View style={styles.formButtons}>
            <Button variant="ghost" label={t('actions.cancel')} onPress={() => setAdding(null)} style={styles.flex} />
            <Button label={t('onboarding.family.add')} onPress={add} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <View style={styles.addRow}>
          <AddButton label={t('onboarding.family.addAdult')} onPress={() => openForm('ADULT')} />
          {withKids ? <AddButton label={t('onboarding.family.addChild')} onPress={() => openForm('CHILD')} /> : null}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <Spacer />
      <Button
        label={people.length ? t('actions.next') : t('onboarding.family.skip')}
        onPress={next}
        loading={busy}
        disabled={!!adding}
      />
    </Screen>
  );
}

function PersonRow({
  magnet,
  title,
  sub,
  role,
  onRemove,
  removeLabel,
}: {
  magnet: ReactNode;
  title: string;
  sub: string;
  role: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { tokens } = usePalette();
  return (
    <View style={[styles.row, { backgroundColor: tokens.paper }]}>
      {magnet}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: tokens.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: tokens.textSecondary }]}>{sub}</Text>
      </View>
      <Text style={[styles.badge, { backgroundColor: tokens.backgroundSelected, color: tokens.textSecondary }]}>{role}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={removeLabel} hitSlop={8} style={styles.remove}>
          <Ionicons name="close" size={18} color={tokens.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.add, { borderColor: tokens.textSecondary, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.addText, { color: tokens.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  dots: { flex: 1 },
  backSpace: { width: 44 },
  flex: { flex: 1 },
  title: { fontFamily: FontFamily.hand, fontSize: 30, lineHeight: 34, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: -8 },
  list: { gap: 10 },
  row: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontFamily: FontFamily.bold, fontSize: 15.5 },
  rowSub: { fontFamily: FontFamily.regular, fontSize: 12.5 },
  badge: {
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 10 },
  add: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  addText: { fontFamily: FontFamily.bold, fontSize: 14 },
  form: { gap: 10, paddingVertical: 14 },
  formTitle: { fontFamily: FontFamily.bold, fontSize: 15 },
  formButtons: { flexDirection: 'row', gap: 10 },
});
