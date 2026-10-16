import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { api, errorMessage, keys, type Invite } from '@/api';
import { Empty, PaperNote, Segmented, TopBar, useRoleLabel } from '@/components/magneten/family/parts';
import { Button, Card, Screen, SectionLabel, Title } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { formatShortDate } from '@/lib/family-dates';
import { joinUrl } from '@/lib/family-invite';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

type InviteRole = 'ADULT' | 'HELPER';

export default function InviteScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const roleLabel = useRoleLabel();
  const { hid, isAdult, membership, memberById } = useHousehold();
  const { data: invites, mutate } = useSWR(isAdult ? keys.invites(hid) : null, () => api.invites.list(hid));
  const [role, setRole] = useState<InviteRole>('ADULT');
  const [shown, setShown] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isAdult) {
    return (
      <Screen>
        <TopBar icon="close" />
        <Empty pose="lurer" title={t('family.invite.adultsOnly')} />
      </Screen>
    );
  }

  const create = async () => {
    setBusy(true);
    try {
      const invite = await api.invites.create(hid, { role });
      setShown(invite);
      setCopied(false);
      Feel.smack();
      mutate((list) => [invite, ...(list ?? [])], { revalidate: false });
    } catch (e) {
      Alert.alert(t('family.invite.failed'), errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const share = (invite: Invite) =>
    Share.share({
      message: t('family.invite.shareMessage', { household: membership.name, url: joinUrl(invite.code), code: invite.code }),
    }).catch(() => {});

  const copy = async (invite: Invite) => {
    try {
      await Clipboard.setStringAsync(joinUrl(invite.code));
      Feel.tick();
      setCopied(true);
    } catch {
      // Clipboard can be unavailable; nothing to tell the user beyond not ticking.
    }
  };

  const revoke = (invite: Invite) => {
    Alert.alert(t('family.invite.revokeTitle'), t('family.invite.revokeBody', { code: invite.code }), [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: t('family.invite.revoke'),
        style: 'destructive',
        onPress: async () => {
          mutate((list) => list?.filter((i) => i.id !== invite.id), { revalidate: false });
          if (shown?.id === invite.id) setShown(null);
          try {
            await api.invites.revoke(hid, invite.id);
          } catch (e) {
            Alert.alert(t('family.invite.failed'), errorMessage(e));
          } finally {
            mutate();
          }
        },
      },
    ]);
  };

  const inviteLabel = (i: Invite) => {
    const claimed = memberById(i.memberId);
    return claimed ? t('family.invite.claimFor', { name: claimed.displayName }) : roleLabel(i.role);
  };

  return (
    <Screen>
      <TopBar icon="close" />
      <Title kicker={membership.name} title={t('family.invite.title')} />

      {shown ? (
        <PaperNote paper={tokens.paperYellow} magnet={tokens.magne} tilt={-0.8} centered>
          <Text style={[styles.hand, { color: tokens.paperInk }]}>
            {shown.memberId
              ? inviteLabel(shown)
              : t('family.invite.codeFor', { role: roleLabel(shown.role).toLowerCase() })}
          </Text>
          <Text
            selectable
            style={[styles.code, { color: tokens.paperInk }]}
            accessibilityLabel={t('family.invite.codeA11y', { code: shown.code.split('').join(' ') })}>
            {shown.code}
          </Text>
          <View style={styles.qr} accessible accessibilityLabel={t('family.invite.qrA11y')}>
            <QRCode value={joinUrl(shown.code)} size={168} color="#1B2326" backgroundColor="#FFFFFF" />
          </View>
          <Text style={[styles.small, { color: tokens.paperInk }]}>
            {t('family.invite.expires', { date: formatShortDate(shown.expiresAt, i18n.language) })}
          </Text>
          <View style={styles.row}>
            <Button label={t('family.invite.share')} onPress={() => share(shown)} style={{ flex: 1 }} />
            <Button
              variant="outline"
              label={copied ? t('family.invite.copied') : t('family.invite.copy')}
              onPress={() => copy(shown)}
              style={{ flex: 1 }}
            />
          </View>
        </PaperNote>
      ) : null}

      <SectionLabel>{shown ? t('family.invite.another') : t('family.invite.who')}</SectionLabel>
      <Card style={styles.pad}>
        <Segmented<InviteRole>
          label={t('family.invite.who')}
          value={role}
          onChange={setRole}
          options={[
            { value: 'ADULT', label: roleLabel('ADULT') },
            { value: 'HELPER', label: roleLabel('HELPER') },
          ]}
        />
        <Text style={[styles.small, { color: tokens.textSecondary }]}>{t(`family.roles.help.${role}`)}</Text>
        <Button label={t('family.invite.create')} onPress={create} loading={busy} />
        <Text style={[styles.small, { color: tokens.textSecondary }]}>{t('family.invite.childHint')}</Text>
      </Card>

      {invites && invites.length > 0 ? (
        <>
          <SectionLabel>{t('family.invite.active')}</SectionLabel>
          <Card>
            {invites.map((inv, i) => (
              <View
                key={inv.id}
                style={[
                  styles.inviteRow,
                  i < invites.length - 1 && { borderBottomWidth: 1, borderBottomColor: tokens.backgroundSelected },
                ]}>
                <Pressable
                  onPress={() => {
                    setShown(inv);
                    setCopied(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('family.invite.showA11y', { code: inv.code })}
                  style={styles.inviteText}>
                  <Text style={[styles.inviteCode, { color: tokens.text }]}>{inv.code}</Text>
                  <Text style={[styles.small, { color: tokens.textSecondary }]}>
                    {inviteLabel(inv)} ·{' '}
                    {t('family.invite.expires', { date: formatShortDate(inv.expiresAt, i18n.language) })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => revoke(inv)}
                  accessibilityRole="button"
                  accessibilityLabel={t('family.invite.revokeA11y', { code: inv.code })}
                  style={styles.revoke}>
                  <Text style={[styles.revokeText, { color: tokens.danger }]}>{t('family.invite.revoke')}</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hand: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 20, lineHeight: 29, textAlign: 'center' },
  code: { fontFamily: FontFamily.extraBold, fontSize: 40, letterSpacing: 6, textAlign: 'center' },
  qr: { alignSelf: 'center', padding: 10, backgroundColor: '#FFFFFF', borderRadius: 12 },
  small: { fontFamily: FontFamily.regular, fontSize: 12.5, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  pad: { paddingVertical: 12, gap: 10 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  inviteText: { flex: 1, paddingVertical: 10, gap: 1 },
  inviteCode: { fontFamily: FontFamily.extraBold, fontSize: 16, letterSpacing: 2 },
  revoke: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  revokeText: { fontFamily: FontFamily.bold, fontSize: 13 },
});
