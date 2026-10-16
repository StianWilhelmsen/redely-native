import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Magne } from '@/components/magneten/magne';
import { BackButton, ErrorText, PinNote, Spacer } from '@/components/magneten/onboarding/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Field, Screen } from '@/components/magneten/ui';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { FontFamily, MemberColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { peekPendingInviteCode } from '@/lib/pending-invite';
import { getLastSignIn, type LastSignIn, type SignInMethod } from '@/lib/provider-profile';
import { usePalette } from '@/theme/palette-context';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in = sign up: Apple, Google, or a code on email. "Jeg har allerede en konto"
 * opens the same screen as "Velkommen tilbake", with a one-tap card for however this
 * phone signed in last time.
 */
export default function SignIn() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const returning = mode === 'login';
  const { signInWithApple, signInWithGoogle, sendEmailCode, signInError, clearSignInError } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<SignInMethod | 'last' | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [last, setLast] = useState<LastSignIn | null>(null);
  const hasInvite = !!peekPendingInviteCode();

  useEffect(() => {
    clearSignInError();
    if (!returning) return;
    getLastSignIn().then((l) => {
      setLast(l);
      if (l?.email) setEmail(l.email);
    });
  }, [returning, clearSignInError]);

  const sendCode = async (address: string, as: SignInMethod | 'last' = 'email') => {
    const trimmed = address.trim();
    if (!EMAIL.test(trimmed)) {
      setEmailError(t('auth.errors.emailInvalid'));
      return;
    }
    setEmailError(null);
    setBusy(as);
    try {
      await sendEmailCode(trimmed);
      router.push({ pathname: '/code', params: { email: trimmed } });
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : t('auth.errors.sendFailed'));
    } finally {
      setBusy(null);
    }
  };

  const run = async (method: SignInMethod, as: SignInMethod | 'last' = method) => {
    if (method === 'email') return sendCode(last?.email ?? email, as);
    setBusy(as);
    try {
      await (method === 'apple' ? signInWithApple() : signInWithGoogle());
    } finally {
      setBusy(null);
    }
  };

  // Apple and Google sign-in are tied to the app's own bundle id and URL scheme, so they
  // cannot work inside Expo Go - only the email code does. Hide them there.
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const showApple = Platform.OS === 'ios' && !inExpoGo;
  const showGoogle = !inExpoGo;
  const lastName = last?.name || last?.email || null;

  return (
    <Screen contentStyle={styles.content}>
      <BackButton />

      {returning ? (
        <View style={styles.returnHead}>
          <Text style={[styles.bigTitle, { color: tokens.text }]} accessibilityRole="header">
            {t('auth.signIn.returnTitle')}
          </Text>
          <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('auth.signIn.returnSub')}</Text>
        </View>
      ) : (
        <View style={styles.createHead}>
          <Magne pose="glad" size={76} />
          <View style={styles.createText}>
            <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
              {t('auth.signIn.createTitle')}
            </Text>
            <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('auth.signIn.createSub')}</Text>
          </View>
        </View>
      )}

      {returning && last && lastName ? (
        <>
          <PinNote
            tilt={-1}
            pinSize={60}
            pin={<PhotoMagnet name={lastName} color={MemberColors[0]} size={60} />}
            style={styles.lastCard}
            contentStyle={styles.lastCardInner}>
            <Text style={[styles.lastName, { color: tokens.paperInk }]}>{lastName}</Text>
            <Text style={[styles.small, { color: tokens.textSecondary }]}>
              {t('auth.signIn.lastUsed', { method: t(`auth.signIn.methods.${last.method}`) })}
            </Text>
            <Button
              label={t('auth.signIn.continueAs', { name: lastName.split(' ')[0] })}
              onPress={() => run(last.method, 'last')}
              loading={busy === 'last'}
              disabled={!!busy && busy !== 'last'}
              style={styles.wide}
            />
          </PinNote>
          <Text style={[styles.otherWays, { color: tokens.textSecondary }]}>
            {t('auth.signIn.otherWays').toUpperCase()}
          </Text>
        </>
      ) : null}

      <View style={styles.providers}>
        {showApple ? (
          <ProviderButton
            icon="logo-apple"
            label={t('auth.signIn.apple')}
            filled
            loading={busy === 'apple'}
            disabled={!!busy}
            onPress={() => run('apple')}
          />
        ) : null}
        {showGoogle ? (
          <ProviderButton
            icon="logo-google"
            label={t('auth.signIn.google')}
            loading={busy === 'google'}
            disabled={!!busy}
            onPress={() => run('google')}
          />
        ) : null}
      </View>
      <ErrorText>{signInError}</ErrorText>

      {showGoogle ? (
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: tokens.border }]} />
        <Text style={[styles.dividerText, { color: tokens.textSecondary }]}>{t('auth.signIn.orEmail')}</Text>
        <View style={[styles.line, { backgroundColor: tokens.border }]} />
      </View>
      ) : null}

      <Field
        label={t('auth.signIn.emailLabel')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (emailError) setEmailError(null);
        }}
        placeholder={t('auth.signIn.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={() => sendCode(email)}
      />
      <Button
        variant="magne"
        label={t('auth.signIn.sendCode')}
        onPress={() => sendCode(email)}
        loading={busy === 'email'}
        disabled={!!busy && busy !== 'email'}
        style={styles.square}
      />
      <ErrorText>{emailError}</ErrorText>
      {/* A code already sent stays valid for an hour; Supabase refuses to send another for a
          while, so this must never be a dead end. */}
      <Button
        variant="ghost"
        label={t('auth.signIn.haveCode')}
        onPress={() => {
          const trimmed = email.trim();
          if (!EMAIL.test(trimmed)) return setEmailError(t('auth.errors.emailInvalid'));
          router.push({ pathname: '/code', params: { email: trimmed } });
        }}
      />

      {returning ? null : (
        <PinNote paper="yellow" tilt={-1} redPin style={styles.inviteNote}>
          <Text style={[styles.noteTitle, { color: tokens.paperInk }]}>{t('auth.signIn.inviteTitle')}</Text>
          <Text style={[styles.small, { color: tokens.textSecondary }]}>
            {hasInvite ? t('auth.signIn.invitePending') : t('auth.signIn.inviteBody')}
          </Text>
        </PinNote>
      )}

      <Spacer />

      {returning ? (
        <View style={styles.magneFoot}>
          <Magne pose="hei" size={60} />
          <Text style={[styles.small, styles.footText, { color: tokens.textSecondary }]}>
            {t('auth.signIn.switchPhone')}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.terms, { color: tokens.textSecondary }]}>
        {t('auth.signIn.termsPrefix')}
        <Text
          accessibilityRole="link"
          onPress={() => router.push(TERMS_ROUTE)}
          style={[styles.link, { color: tokens.text }]}>
          {t('auth.signIn.terms')}
        </Text>
        {t('auth.signIn.and')}
        <Text
          accessibilityRole="link"
          onPress={() => router.push(PRIVACY_ROUTE)}
          style={[styles.link, { color: tokens.text }]}>
          {t('auth.signIn.privacy')}
        </Text>
        {t('auth.signIn.termsSuffix')}
      </Text>
    </Screen>
  );
}

function ProviderButton({
  icon,
  label,
  filled = false,
  loading,
  disabled,
  onPress,
}: {
  icon: 'logo-apple' | 'logo-google';
  label: string;
  filled?: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { tokens } = usePalette();
  return (
    <View>
      <Button
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled && !loading}
        variant={filled ? 'ink' : 'outline'}
        style={[styles.square, !filled && { backgroundColor: tokens.paper }]}
      />
      {loading ? null : (
        <View pointerEvents="none" style={styles.providerIcon}>
          <Ionicons name={icon} size={18} color={filled ? tokens.onInk : tokens.text} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  createHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  createText: { flex: 1, paddingBottom: 12 },
  returnHead: { alignItems: 'center', gap: 6, marginTop: 10 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 32, lineHeight: 46 },
  bigTitle: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 34, lineHeight: 49, textAlign: 'center' },
  sub: { fontFamily: FontFamily.regular, fontSize: 14 },
  small: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  lastCard: { marginTop: 16 },
  lastCardInner: { alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 18 },
  lastName: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 22, lineHeight: 32 },
  wide: { alignSelf: 'stretch', borderRadius: 14, marginTop: 2 },
  otherWays: { fontFamily: FontFamily.extraBold, fontSize: 12.5, letterSpacing: 0.8, textAlign: 'center', marginTop: 10 },
  providers: { gap: 10, marginTop: 6 },
  square: { borderRadius: 14 },
  providerIcon: { position: 'absolute', left: 18, top: 0, bottom: 0, justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1.5 },
  dividerText: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  inviteNote: { marginTop: 8 },
  noteTitle: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 18, lineHeight: 26 },
  magneFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  footText: { flex: 1, paddingBottom: 12 },
  terms: { fontFamily: FontFamily.regular, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  link: { fontFamily: FontFamily.bold, textDecorationLine: 'underline' },
});
