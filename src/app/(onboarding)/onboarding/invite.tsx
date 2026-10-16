import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import useSWR from 'swr';

import { api, errorMessage, keys, type Invite } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { draftAdultNames } from '@/components/magneten/onboarding/draft';
import { ErrorText, PinNote, Spacer, StepDots } from '@/components/magneten/onboarding/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Screen } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { formatInviteCode, inviteLink } from '@/lib/invite-code';
import { useMeState } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

function isPlainAdultInvite(i: Invite) {
  return i.role === 'ADULT' && !i.memberId && new Date(i.expiresAt).getTime() > Date.now();
}

/** Step 4: get the other grown-up onto the door. One plain ADULT invite, shared as a link. */
export default function InviteStep() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { current } = useMeState();
  const hid = current?.householdId;

  const adults = draftAdultNames();
  const invitee = adults.length === 1 ? adults[0] : null;

  const { data: invites, error: listError, mutate } = useSWR(hid ? keys.invites(hid) : null, () => api.invites.list(hid!));
  const invite = invites?.find(isPlainAdultInvite);
  const [createError, setCreateError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [shared, setShared] = useState(false);

  // No usable invite yet (the usual case): write one.
  useEffect(() => {
    if (!hid || !invites || invite || createError) return;
    api.invites
      .create(hid, { role: 'ADULT' })
      .then((created) => mutate([created, ...invites], { revalidate: false }))
      .catch(setCreateError);
  }, [hid, invites, invite, createError, mutate]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const myName = current?.displayName ?? '';
  const household = current?.name ?? '';
  const code = invite ? formatInviteCode(invite.code) : null;
  const link = code ? inviteLink(code) : null;
  const failure = listError ?? createError;

  const share = async () => {
    if (!code || !link) return;
    try {
      const result = await Share.share({
        message: t('onboarding.invite.shareMessage', { name: myName, household, link, code }),
      });
      if (result.action === Share.sharedAction) setShared(true);
    } catch {
      // The share sheet closing is not an error worth showing.
    }
  };

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Feel.tick();
    setCopied(true);
  };

  const next = () => router.push('/onboarding/notifications');

  return (
    <Screen contentStyle={styles.content}>
      <StepDots step={4} />

      <View style={styles.head}>
        <Magne pose="hei" size={80} />
        <View style={styles.headText}>
          <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
            {invitee ? t('onboarding.invite.title', { name: invitee }) : t('onboarding.invite.titleGeneric')}
          </Text>
          <Text style={[styles.sub, { color: tokens.textSecondary }]}>
            {invitee ? t('onboarding.invite.sub') : t('onboarding.invite.subGeneric')}
          </Text>
        </View>
      </View>

      <PinNote
        tilt={-1.2}
        pinSize={36}
        pin={current ? <PhotoMagnet name={myName} color={current.color} photoUrl={current.photoUrl} size={36} /> : null}
        style={styles.note}
        contentStyle={styles.noteInner}>
        <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{t('onboarding.invite.preview').toUpperCase()}</Text>
        <Text style={[styles.message, { color: tokens.paperInk }]}>
          {t('onboarding.invite.message', { name: myName, household })}
        </Text>
        <View style={[styles.codeBox, { backgroundColor: tokens.backgroundSelected }]}>
          <View>
            <Text style={[styles.codeLabel, { color: tokens.textSecondary }]}>{t('onboarding.invite.codeLabel')}</Text>
            <Text
              style={[styles.code, { color: tokens.text }]}
              accessibilityLabel={code ? code.split('').join(' ') : t('onboarding.invite.loading')}>
              {code ?? t('onboarding.invite.loading')}
            </Text>
          </View>
          <Pressable
            onPress={copy}
            disabled={!code}
            accessibilityRole="button"
            accessibilityLabel={copied ? t('onboarding.invite.copied') : t('onboarding.invite.copy')}
            style={[styles.copy, { backgroundColor: tokens.paper }]}>
            <Text style={[styles.copyText, { color: copied ? tokens.stamp : tokens.text }]}>
              {copied ? t('onboarding.invite.copied') : t('onboarding.invite.copy')}
            </Text>
          </Pressable>
        </View>
        {showQr && link ? (
          <View style={styles.qr} accessible accessibilityRole="image" accessibilityLabel={t('onboarding.invite.qrLabel')}>
            <QRCode value={link} size={168} color={tokens.paperInk} backgroundColor={tokens.paper} />
          </View>
        ) : null}
        <Text style={[styles.small, { color: tokens.textSecondary }]}>{t('onboarding.invite.validity')}</Text>
      </PinNote>

      <ErrorText>{failure ? errorMessage(failure) : null}</ErrorText>
      {failure ? (
        <Button
          variant="outline"
          label={t('actions.retry')}
          onPress={() => {
            setCreateError(null);
            mutate();
          }}
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          label={invitee ? t('onboarding.invite.send', { name: invitee }) : t('onboarding.invite.sendGeneric')}
          onPress={share}
          disabled={!code}
        />
        <Button
          variant="outline"
          label={showQr ? t('onboarding.invite.hideQr') : t('onboarding.invite.showQr')}
          onPress={() => setShowQr((v) => !v)}
          disabled={!code}
        />
      </View>

      <Spacer />
      <Button
        variant={shared ? 'ink' : 'ghost'}
        label={shared ? t('onboarding.invite.next') : t('onboarding.invite.later')}
        onPress={next}
        style={styles.later}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6 },
  headText: { flex: 1, paddingBottom: 10 },
  title: { fontFamily: FontFamily.hand, fontSize: 28, lineHeight: 32 },
  sub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 19 },
  note: { marginTop: 8 },
  noteInner: { gap: 10, paddingHorizontal: 18, paddingBottom: 18 },
  kicker: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.7 },
  message: { fontFamily: FontFamily.hand, fontSize: 21, lineHeight: 25 },
  codeBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  codeLabel: { fontFamily: FontFamily.regular, fontSize: 11.5 },
  code: { fontFamily: FontFamily.extraBold, fontSize: 20, letterSpacing: 1.6 },
  copy: { borderRadius: 999, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  copyText: { fontFamily: FontFamily.bold, fontSize: 13 },
  qr: { alignItems: 'center', paddingVertical: 6 },
  small: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17 },
  actions: { gap: 10 },
  later: { minHeight: 44 },
});
