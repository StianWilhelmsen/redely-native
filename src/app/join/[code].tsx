import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import useSWR from 'swr';

import { ApiError, api, errorMessage, type Member, type MyHousehold } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { CodeBoxes } from '@/components/magneten/onboarding/code-boxes';
import { MiniDoor, PinNote, Spacer } from '@/components/magneten/onboarding/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Card, Field, Screen } from '@/components/magneten/ui';
import { FontFamily, MemberColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { Feel, Landing } from '@/design/motion';
import { INVITE_CODE_LENGTH, isCompleteInviteCode, normalizeInviteCode } from '@/lib/invite-code';
import { setPendingInviteCode } from '@/lib/pending-invite';
import { getRememberedProviderName } from '@/lib/provider-profile';
import { useMeState } from '@/state/household';
import { setOnboardingActive } from '@/state/onboarding-flag';
import { usePalette } from '@/theme/palette-context';

const FLY = 700;

/**
 * Where an invite link lands (https://magneten.app/bli-med/<CODE> → join/<CODE>).
 * Signed out: keep the code and go sign in; onboarding brings you back here. Signed in:
 * the door, your empty spot, and your magnet flying onto it.
 */
export default function JoinScreen() {
  const { status } = useAuth();
  const { code: raw = '' } = useLocalSearchParams<{ code?: string }>();
  const code = normalizeInviteCode(raw);
  if (status !== 'signedIn') return <JoinSignedOut code={code} />;
  return <JoinSignedIn code={code} />;
}

function Centered({ children }: { children: ReactNode }) {
  return <Screen contentStyle={styles.centered}>{children}</Screen>;
}

function JoinSignedOut({ code }: { code: string }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();

  useEffect(() => {
    if (isCompleteInviteCode(code)) setPendingInviteCode(code);
  }, [code]);

  return (
    <Centered>
      <Magne pose="hei" size={110} />
      <PinNote paper="yellow" tilt={-1.5} redPin style={styles.card} contentStyle={styles.cardInner}>
        <Text style={[styles.cardTitle, { color: tokens.paperInk }]} accessibilityRole="header">
          {t('onboarding.join.signedOutTitle')}
        </Text>
        <Text style={[styles.body, { color: tokens.textSecondary }]}>{t('onboarding.join.signedOutBody')}</Text>
      </PinNote>
      <Spacer />
      <Button label={t('onboarding.join.signedOutGo')} onPress={() => router.replace('/sign-in')} style={styles.stretch} />
    </Centered>
  );
}

type Problem = 'expired' | 'notFound' | 'already';

function problemOf(e: unknown): Problem | null {
  if (!(e instanceof ApiError)) return null;
  if (e.code === 'invite_expired') return 'expired';
  if (e.code === 'invite_not_found') return 'notFound';
  if (e.code === 'already_member') return 'already';
  return null;
}

/** My magnet arriving from below: big, fast, a bounce on impact. */
function FlyIn({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(reduceMotion ? 0 : 260);
  const scale = useSharedValue(reduceMotion ? 1 : 2.2);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const land = FLY * 0.55;
    y.value = withTiming(0, { duration: land, easing: Landing });
    opacity.value = withTiming(1, { duration: land * 0.6 });
    scale.value = withSequence(
      withTiming(0.85, { duration: land, easing: Landing }),
      withTiming(1.1, { duration: FLY * 0.17 }),
      withTiming(0.97, { duration: FLY * 0.14 }),
      withTiming(1, { duration: FLY * 0.14 })
    );
    const timer = setTimeout(Feel.snap, land);
    return () => clearTimeout(timer);
    // Flies in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Typing a code right here - for a bad link, or when opened from Meg without one. */
function OtherCode() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const go = (next: string) => router.replace({ pathname: '/join/[code]', params: { code: next } });
  return (
    <View style={styles.otherCode}>
      <CodeBoxes
        value={value}
        length={INVITE_CODE_LENGTH}
        autoFocus={false}
        onChangeText={(raw) => {
          const next = normalizeInviteCode(raw);
          setValue(next);
          if (next.length === INVITE_CODE_LENGTH && raw.length > value.length + 1) go(next);
        }}
        accessibilityLabel={t('onboarding.code.label')}
        keyboardType="default"
        autoCapitalize="characters"
      />
      <Button
        label={t('onboarding.code.go')}
        onPress={() => go(value)}
        disabled={value.length < INVITE_CODE_LENGTH}
      />
    </View>
  );
}

function JoinSignedIn({ code }: { code: string }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { me, current, mutateMe, switchHousehold } = useMeState();
  const valid = isCompleteInviteCode(code);

  const { data: preview, error: previewError, isLoading } = useSWR(valid ? ['invite-preview', code] : null, () =>
    api.invites.preview(code)
  );

  const [name, setName] = useState(me?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [joinProblem, setJoinProblem] = useState<Problem | null>(null);
  const [joined, setJoined] = useState<{ membership: MyHousehold; members: Member[] } | null>(null);

  useEffect(() => {
    if (name) return;
    getRememberedProviderName().then((n) => n && setName((v) => v || n.split(/\s+/)[0]));
    // Prefill once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once joined, a revalidated preview says alreadyMember - that is the success, not a problem.
  const problem: Problem | null = joined
    ? null
    : !valid
      ? 'notFound'
      : (joinProblem ?? problemOf(previewError) ?? (preview?.alreadyMember ? 'already' : null));

  const goToDoor = async (hid: string) => {
    switchHousehold(hid);
    setOnboardingActive(false);
    await mutateMe();
    router.replace('/');
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const join = async () => {
    if (!preview) return;
    const claim = !!preview.memberDisplayName;
    const displayName = name.trim();
    if (!claim && !displayName) {
      Alert.alert(t('onboarding.join.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      // Joiners skip onboarding, so record the terms (accepted at sign-in) and the name here.
      if (!me?.termsAcceptedAt || (!claim && displayName !== me?.name)) {
        await api.me
          .update({ acceptTerms: true, ...(claim ? {} : { name: displayName }) })
          .then((next) => mutateMe(next, { revalidate: false }))
          .catch((e) => console.warn('[join] could not update profile', e));
      }
      const membership = await api.invites.accept(code, claim ? undefined : displayName);
      const household = await api.households.get(membership.householdId).catch(() => null);
      setJoined({ membership, members: household?.members ?? [] });
    } catch (e) {
      const p = problemOf(e);
      if (p) setJoinProblem(p);
      else Alert.alert(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (problem) {
    const household = preview?.householdName ?? '';
    return (
      <Centered>
        <Magne pose={problem === 'already' ? 'glad' : 'lurer'} size={110} />
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
          {code ? t(`onboarding.join.${problem}Title`) : t('onboarding.code.title')}
        </Text>
        <Text style={[styles.body, styles.center, { color: tokens.textSecondary }]}>
          {code ? t(`onboarding.join.${problem}Body`, { household }) : t('onboarding.code.sub')}
        </Text>
        <Spacer />
        {problem === 'already' && preview ? (
          <Button label={t('onboarding.join.goToDoor')} onPress={() => goToDoor(preview.householdId)} style={styles.stretch} />
        ) : (
          <>
            <OtherCode />
            <Button
              variant={current ? 'ink' : 'ghost'}
              label={current ? t('onboarding.join.goToDoor') : t('onboarding.join.back')}
              onPress={leave}
              style={styles.stretch}
            />
          </>
        )}
      </Centered>
    );
  }

  if (!preview || isLoading) {
    return (
      <Centered>
        <Magne pose={previewError ? 'lurer' : 'trekker'} size={110} />
        <Text style={[styles.body, styles.center, { color: tokens.textSecondary }]}>
          {previewError ? errorMessage(previewError) : t('onboarding.join.loading')}
        </Text>
        {previewError ? <Button variant="ghost" label={t('onboarding.join.back')} onPress={leave} /> : null}
      </Centered>
    );
  }

  const claimName = preview.memberDisplayName;
  const inviter = preview.invitedByName;
  const others = joined ? joined.members.filter((m) => m.id !== joined.membership.memberId) : [];
  const count = joined ? Math.max(joined.members.length, others.length + 1) : 0;
  const myName = joined?.membership.displayName ?? (claimName || name.trim());

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.head}>
        {inviter ? (
          <View style={styles.invitedBy}>
            <PhotoMagnet name={inviter} color={MemberColors[0]} size={22} />
            <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{t('onboarding.join.invitedBy', { name: inviter })}</Text>
          </View>
        ) : (
          <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{t('onboarding.join.invited')}</Text>
        )}
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {joined ? t('onboarding.join.joinedTitle') : t('onboarding.join.title', { household: preview.householdName })}
        </Text>
      </View>

      <MiniDoor shakeKey={joined ? 1 : 0} delay={FLY * 0.55} style={styles.door}>
        <View style={styles.magnets}>
          {joined
            ? others.map((m) => <PhotoMagnet key={m.id} name={m.displayName} color={m.color} photoUrl={m.photoUrl} size={50} />)
            : inviter
              ? <PhotoMagnet name={inviter} color={MemberColors[0]} size={50} />
              : null}
          {joined ? (
            <FlyIn>
              <PhotoMagnet
                name={joined.membership.displayName}
                color={joined.membership.color}
                photoUrl={joined.membership.photoUrl}
                size={50}
              />
            </FlyIn>
          ) : (
            <View
              accessible
              accessibilityLabel={t('onboarding.join.emptySlot')}
              style={[styles.slot, { borderColor: tokens.textSecondary }]}
            />
          )}
        </View>
        <PinNote tilt={-2} style={styles.doorNote} contentStyle={styles.doorNoteInner}>
          <Text style={[styles.doorNoteText, { color: tokens.paperInk }]}>
            {joined ? t('onboarding.join.joinedNote', { name: myName }) : t('onboarding.join.slot')}
          </Text>
        </PinNote>
      </MiniDoor>

      <Spacer />

      {joined ? (
        <Animated.View entering={FadeInUp.delay(FLY * 0.6).duration(400)} style={styles.welcome}>
          <Magne pose="jubler" size={80} />
          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeLine, { color: tokens.text }]}>
              {count > 1
                ? t('onboarding.join.welcome', { name: myName, count })
                : t('onboarding.join.welcomeShort', { name: myName })}
            </Text>
            <Button label={t('onboarding.join.goToDoor')} onPress={() => goToDoor(joined.membership.householdId)} />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.actions}>
          <Card style={styles.roleCard}>
            <Text style={[styles.small, { color: tokens.textSecondary }]}>
              {claimName ? t('onboarding.join.claimAs', { name: claimName }) : t('onboarding.join.as')}
            </Text>
            <Text style={[styles.role, { color: tokens.text }]}>
              {t(`onboarding.join.roles.${preview.role}.name`)} · {t(`onboarding.join.roles.${preview.role}.desc`)}
            </Text>
            {inviter ? (
              <Text style={[styles.small, { color: tokens.textSecondary }]}>{t('onboarding.join.changeLater', { name: inviter })}</Text>
            ) : null}
          </Card>
          {claimName ? null : (
            <Field
              label={t('onboarding.join.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.join.namePlaceholder')}
              autoComplete="name"
              maxLength={80}
            />
          )}
          <Button label={t('onboarding.join.join')} onPress={join} loading={busy} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, paddingHorizontal: 22, alignItems: 'center', paddingTop: 40 },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  stretch: { alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  card: { alignSelf: 'stretch', marginTop: 8 },
  cardInner: { gap: 6, paddingHorizontal: 16, paddingBottom: 16 },
  cardTitle: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 24, lineHeight: 35 },
  head: { alignItems: 'center', gap: 4, marginTop: 20 },
  invitedBy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: FontFamily.bold, fontSize: 13 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 32, lineHeight: 46, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 21 },
  small: { fontFamily: FontFamily.regular, fontSize: 13 },
  door: {
    alignSelf: 'center',
    width: 250,
    minHeight: 300,
    marginTop: 12,
    paddingTop: 34,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  magnets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: 190 },
  slot: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderStyle: 'dashed' },
  doorNote: { marginTop: 22, width: 170 },
  doorNoteInner: { alignItems: 'center', paddingHorizontal: 10, paddingBottom: 12, paddingTop: 12 },
  doorNoteText: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  actions: { gap: 12 },
  otherCode: { alignSelf: 'stretch', gap: 12 },
  roleCard: { paddingVertical: 12, gap: 3 },
  role: { fontFamily: FontFamily.bold, fontSize: 15 },
  welcome: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  welcomeText: { flex: 1, gap: 10, paddingBottom: 10 },
  welcomeLine: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 22, lineHeight: 32 },
});
