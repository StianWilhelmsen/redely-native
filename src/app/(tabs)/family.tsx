import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { api, errorMessage, keys, type Member } from '@/api';
import { LinkTile, PillButton, RolePill } from '@/components/magneten/family/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Card, Chip, Field, Screen, SectionLabel, Title } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { ageFromBirthYear } from '@/lib/family-dates';
import { useHousehold, useMeState } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function FamilyScreen() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { hid, household, membership, members, isAdult, mutateHousehold } = useHousehold();
  const { me: account, switchHousehold } = useMeState();
  const { data: areas } = useSWR(keys.areas(hid), () => api.areas.list(hid));

  const owned = useMemo(() => {
    const counts = new Map<string, number>();
    areas?.forEach((a) => a.ownerMemberId && counts.set(a.ownerMemberId, (counts.get(a.ownerMemberId) ?? 0) + 1));
    return counts;
  }, [areas]);

  const family = members.filter((m) => m.role !== 'HELPER');
  const helpers = members.filter((m) => m.role === 'HELPER');
  const children = members.filter((m) => m.role === 'CHILD');
  // A child signed in on their own phone only gets their own kid door.
  const kidDoors = membership.role === 'CHILD' ? children.filter((c) => c.isMe) : children;
  const households = account?.households ?? [];

  const subLine = (m: Member) => {
    const parts: string[] = [];
    if (m.isMe) parts.push(t('family.list.you'));
    const n = owned.get(m.id) ?? 0;
    if (n > 0) parts.push(t('family.list.owns', { count: n }));
    if (!m.hasLogin) parts.push(t('family.list.noLogin'));
    if (m.role === 'HELPER' && parts.length === 0) parts.push(t('family.list.helperSub'));
    return parts.join(' · ');
  };

  const open = (m: Member) => {
    if (m.isMe) router.push('/me');
    else router.push({ pathname: '/member/[id]', params: { id: m.id } });
  };

  return (
    <Screen tabs>
      {households.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
          {households.map((h) => (
            <Chip
              key={h.householdId}
              label={h.name}
              selected={h.householdId === hid}
              member={{ name: h.displayName, color: h.color, photoUrl: h.photoUrl }}
              onPress={() => h.householdId !== hid && switchHousehold(h.householdId)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Title
        kicker={
          household
            ? t('family.list.kicker', { name: household.name, count: members.length })
            : membership.name
        }
        title={t('family.list.title')}
        right={isAdult ? <PillButton label={t('family.list.invite')} onPress={() => router.push('/invite')} /> : null}
      />

      <Card>
        {family.map((m, i) => (
          <MemberRow key={m.id} member={m} sub={subLine(m)} last={i === family.length - 1} onPress={() => open(m)} />
        ))}
        {!household ? <Text style={[styles.loading, { color: tokens.textSecondary }]}>{t('loading')}</Text> : null}
      </Card>

      {isAdult ? <AddChild onAdded={() => mutateHousehold()} hid={hid} /> : null}

      {helpers.length > 0 ? (
        <>
          <SectionLabel>{t('family.list.helpers')}</SectionLabel>
          <Card>
            {helpers.map((m, i) => (
              <MemberRow key={m.id} member={m} sub={subLine(m)} last={i === helpers.length - 1} onPress={() => open(m)} />
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.tiles}>
        <LinkTile label={t('family.list.areas')} onPress={() => router.push('/areas')} />
        {kidDoors.length === 1 ? (
          <LinkTile
            label={t('family.list.kidMode')}
            hint={t('family.list.kidModeFor', { name: kidDoors[0].displayName })}
            onPress={() => router.push({ pathname: '/kid/[id]', params: { id: kidDoors[0].id } })}
          />
        ) : null}
      </View>
      {kidDoors.length > 1 ? (
        <View style={styles.tiles}>
          {kidDoors.map((c) => (
            <LinkTile
              key={c.id}
              label={t('family.list.kidModeFor', { name: c.displayName })}
              onPress={() => router.push({ pathname: '/kid/[id]', params: { id: c.id } })}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function MemberRow({ member, sub, last, onPress }: { member: Member; sub: string; last: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const age = member.role === 'CHILD' ? ageFromBirthYear(member.birthYear) : null;
  const name = age !== null ? t('family.list.nameAge', { name: member.displayName, age }) : member.displayName;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${name}, ${sub}` : name}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: tokens.backgroundSelected },
        pressed && { opacity: 0.75 },
      ]}>
      <PhotoMagnet name={member.displayName} color={member.color} photoUrl={member.photoUrl} size={40} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.name, { color: tokens.text }]}>
          {name}
        </Text>
        {sub ? (
          <Text numberOfLines={1} style={[styles.sub, { color: tokens.textSecondary }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      <RolePill role={member.role} />
    </Pressable>
  );
}

/** "Legg til barn": a no-login profile with a name and (optionally) a birth year. */
function AddChild({ hid, onAdded }: { hid: string; onAdded: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return <Button variant="outline" label={t('family.addChild.open')} onPress={() => setOpen(true)} />;
  }

  const birthYear = year.trim() ? Number(year.trim()) : null;
  const yearValid = birthYear === null || (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= 2100);

  const add = async () => {
    setBusy(true);
    try {
      await api.members.add(hid, { displayName: name.trim(), role: 'CHILD', birthYear });
      Feel.snap();
      setName('');
      setYear('');
      setOpen(false);
      onAdded();
    } catch (e) {
      Alert.alert(t('family.addChild.failed'), errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.addCard}>
      <Text style={[styles.addHint, { color: tokens.textSecondary }]}>{t('family.addChild.hint')}</Text>
      <Field
        label={t('family.addChild.name')}
        value={name}
        onChangeText={setName}
        placeholder={t('family.addChild.namePlaceholder')}
        autoFocus
        maxLength={80}
        returnKeyType="next"
      />
      <Field
        label={t('family.addChild.birthYear')}
        value={year}
        onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
        placeholder="2017"
        keyboardType="number-pad"
        maxLength={4}
      />
      <View style={styles.addButtons}>
        <Button variant="ghost" label={t('actions.cancel')} onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <Button
          label={t('family.addChild.add')}
          onPress={add}
          loading={busy}
          disabled={!name.trim() || !yearValid}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  switcher: { gap: 8, paddingRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 62 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: FontFamily.bold, fontSize: 15 },
  sub: { fontFamily: FontFamily.regular, fontSize: 12 },
  loading: { fontFamily: FontFamily.regular, fontSize: 13, paddingVertical: 14 },
  tiles: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  addCard: { paddingVertical: 14, gap: 12 },
  addHint: { fontFamily: FontFamily.regular, fontSize: 13 },
  addButtons: { flexDirection: 'row', gap: 10 },
});
