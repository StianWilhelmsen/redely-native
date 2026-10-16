import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { api, ApiError, errorMessage, keys, type Invite, type Member, type MemberRole } from '@/api';
import {
  ColorSwatches,
  Empty,
  Icon,
  PaperNote,
  Segmented,
  SnapMagnet,
  TopBar,
  useRoleLabel,
} from '@/components/magneten/family/parts';
import { useMemberActions } from '@/components/magneten/family/use-member-actions';
import { Button, Card, Field, Screen, SectionLabel } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { joinUrl } from '@/lib/family-invite';
import { useHousehold, useMeState } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function MemberScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { memberById, household } = useHousehold();
  const member = memberById(id);

  if (!member) {
    return (
      <Screen>
        <TopBar />
        {household ? <Empty pose="lurer" title={t('family.member.notFound')} /> : <Empty pose="trekker" title={t('loading')} />}
      </Screen>
    );
  }
  // Keyed so the form starts over if the id changes under us.
  return <MemberEditor key={member.id} member={member} />;
}

function MemberEditor({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const roleLabel = useRoleLabel();
  const { hid, isAdult, mutateHousehold } = useHousehold();
  const { mutateMe } = useMeState();
  const { update, pickPhoto, uploadPhoto, deletePhoto } = useMemberActions();
  const { data: areas } = useSWR(keys.areas(hid), () => api.areas.list(hid));

  const canEdit = isAdult || member.isMe;
  const [name, setName] = useState(member.displayName);
  const [year, setYear] = useState(member.birthYear ? String(member.birthYear) : '');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [claim, setClaim] = useState<Invite | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  const birthYear = year.trim() ? Number(year) : null;
  const yearValid = birthYear === null || (birthYear >= 1900 && birthYear <= 2100);
  const dirty = name.trim() !== member.displayName || birthYear !== member.birthYear;
  const myAreas = (areas ?? []).filter((a) => a.ownerMemberId === member.id);

  const fail = (e: unknown) => {
    const lastAdult = e instanceof ApiError && e.code === 'last_adult';
    Alert.alert(t('family.member.failed'), lastAdult ? t('family.member.lastAdult') : errorMessage(e));
  };

  const save = async () => {
    setSaving(true);
    try {
      await update(member, { displayName: name.trim(), birthYear });
      Feel.done();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const setColor = (color: Member['color']) => update(member, { color }).catch(fail);

  const setRole = (role: MemberRole) => {
    update(member, { role }).catch(fail);
  };

  const choosePhoto = async () => {
    try {
      const photo = await pickPhoto();
      if (!photo) return;
      setPhotoBusy(true);
      await uploadPhoto(member, photo);
      Feel.snap();
    } catch (e) {
      fail(e);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await deletePhoto(member);
    } catch (e) {
      fail(e);
    } finally {
      setPhotoBusy(false);
    }
  };

  const createClaim = async () => {
    setClaimBusy(true);
    try {
      setClaim(await api.invites.create(hid, { role: member.role, memberId: member.id }));
      Feel.smack();
    } catch (e) {
      fail(e);
    } finally {
      setClaimBusy(false);
    }
  };

  const shareClaim = (code: string) =>
    Share.share({ message: t('family.member.claimShare', { name: member.displayName, url: joinUrl(code), code }) }).catch(
      () => {}
    );

  const remove = () => {
    const self = member.isMe;
    Alert.alert(
      self ? t('family.member.leaveTitle') : t('family.member.removeTitle', { name: member.displayName }),
      self ? t('family.member.leaveBody') : t('family.member.removeBody', { name: member.displayName }),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: self ? t('family.member.leave') : t('family.member.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.members.remove(hid, member.id);
              if (self) {
                await mutateMe();
              } else {
                mutateHousehold((h) => h && { ...h, members: h.members.filter((m) => m.id !== member.id) }, {
                  revalidate: true,
                });
              }
              router.back();
            } catch (e) {
              fail(e);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <TopBar />

      <View style={styles.hero}>
        <View>
          <SnapMagnet name={member.displayName} color={member.color} photoUrl={member.photoUrl} size={100} />
          {canEdit ? (
            <Pressable
              onPress={choosePhoto}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel={member.photoUrl ? t('family.photo.change') : t('family.photo.add')}
              style={[styles.camera, { backgroundColor: tokens.ink, borderColor: tokens.door }]}>
              <Icon name="camera" size={18} color={tokens.onInk} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.heroName, { color: tokens.text }]} accessibilityRole="header">
          {member.displayName}
        </Text>
        <Text style={[styles.heroSub, { color: tokens.textSecondary }]}>
          {[roleLabel(member.role), member.hasLogin ? null : t('family.list.noLogin')].filter(Boolean).join(' · ')}
        </Text>
        {canEdit && member.photoUrl ? (
          <Button variant="ghost" label={t('family.photo.remove')} onPress={removePhoto} loading={photoBusy} />
        ) : null}
      </View>

      {canEdit ? (
        <Card style={styles.form}>
          <Field label={t('family.member.name')} value={name} onChangeText={setName} maxLength={80} />
          {member.role === 'CHILD' ? (
            <Field
              label={t('family.addChild.birthYear')}
              value={year}
              onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="2017"
              maxLength={4}
            />
          ) : null}
          {dirty ? (
            <Button label={t('actions.save')} onPress={save} loading={saving} disabled={!name.trim() || !yearValid} />
          ) : null}
        </Card>
      ) : null}

      {canEdit ? (
        <>
          <SectionLabel>{t('family.color.section')}</SectionLabel>
          <Card style={styles.pad}>
            <ColorSwatches value={member.color} onChange={setColor} />
          </Card>
        </>
      ) : null}

      {isAdult ? (
        <>
          <SectionLabel>{t('family.member.role')}</SectionLabel>
          <Card style={styles.pad}>
            <Segmented<MemberRole>
              label={t('family.member.role')}
              value={member.role}
              onChange={setRole}
              options={(['ADULT', 'CHILD', 'HELPER'] as const).map((r) => ({ value: r, label: roleLabel(r) }))}
            />
            <Text style={[styles.help, { color: tokens.textSecondary }]}>{t(`family.roles.help.${member.role}`)}</Text>
          </Card>
        </>
      ) : null}

      {myAreas.length > 0 ? (
        <>
          <SectionLabel>{t('family.member.areas')}</SectionLabel>
          <View style={styles.chips}>
            {myAreas.map((a) => (
              <View key={a.id} style={[styles.areaChip, { backgroundColor: tokens.paper }]}>
                <Text style={[styles.areaChipText, { color: tokens.text }]}>{a.name}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {isAdult && !member.hasLogin ? (
        <>
          <SectionLabel>{t('family.member.claimSection')}</SectionLabel>
          {claim ? (
            <PaperNote paper={tokens.paperYellow} magnet={member.color} tilt={-0.8}>
              <Text style={[styles.claimHand, { color: tokens.paperInk }]}>
                {t('family.member.claimReady', { name: member.displayName })}
              </Text>
              <Text selectable style={[styles.code, { color: tokens.paperInk }]} accessibilityLabel={claim.code.split('').join(' ')}>
                {claim.code}
              </Text>
              <Text style={[styles.help, { color: tokens.paperInk }]}>{t('family.member.claimHow')}</Text>
              <View style={styles.row}>
                <Button label={t('family.invite.share')} onPress={() => shareClaim(claim.code)} style={{ flex: 1 }} />
                <Button
                  variant="outline"
                  label={t('family.invite.copy')}
                  onPress={() => {
                    Clipboard.setStringAsync(joinUrl(claim.code)).then(Feel.tick, () => {});
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </PaperNote>
          ) : (
            <Card style={styles.form}>
              <Text style={[styles.help, { color: tokens.textSecondary }]}>
                {t('family.member.claimHint', { name: member.displayName })}
              </Text>
              <Button
                label={t('family.member.claim', { name: member.displayName })}
                onPress={createClaim}
                loading={claimBusy}
              />
            </Card>
          )}
        </>
      ) : null}

      {isAdult ? (
        <Pressable
          onPress={remove}
          accessibilityRole="button"
          style={({ pressed }) => [styles.danger, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.dangerText, { color: tokens.danger }]}>
            {member.isMe ? t('family.member.leave') : t('family.member.remove')}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6 },
  camera: {
    position: 'absolute',
    right: -6,
    bottom: -2,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontFamily: FontFamily.hand, fontSize: 28, lineHeight: 34, marginTop: 4, textAlign: 'center' },
  heroSub: { fontFamily: FontFamily.regular, fontSize: 13 },
  form: { paddingVertical: 14, gap: 12 },
  pad: { paddingVertical: 12, gap: 10 },
  help: { fontFamily: FontFamily.regular, fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  areaChipText: { fontFamily: FontFamily.bold, fontSize: 13 },
  claimHand: { fontFamily: FontFamily.hand, fontSize: 19, lineHeight: 23 },
  code: { fontFamily: FontFamily.extraBold, fontSize: 34, letterSpacing: 5 },
  row: { flexDirection: 'row', gap: 10 },
  danger: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 8 },
  dangerText: { fontFamily: FontFamily.bold, fontSize: 15 },
});
