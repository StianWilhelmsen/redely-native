import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Magne } from '@/components/magneten/magne';
import { CodeBoxes, type CodeBoxesState } from '@/components/magneten/onboarding/code-boxes';
import { BackButton, ErrorText } from '@/components/magneten/onboarding/parts';
import { Screen } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

const LENGTH = 6;
const RESEND_AFTER_S = 30;

/** The 6 digits from the email. Typing the last one checks it straight away. */
export default function EmailCode() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const { verifyEmailCode, sendEmailCode } = useAuth();

  const [code, setCode] = useState('');
  const [state, setState] = useState<CodeBoxesState>('idle');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    if (!email) router.replace('/sign-in');
  }, [email]);

  const verify = async (token: string) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError(null);
    try {
      await verifyEmailCode(email, token);
      // Signed in: the app swaps to onboarding or the door in a moment.
      setState('ok');
      Feel.cheer();
    } catch (e) {
      setState('error');
      setShakeKey((k) => k + 1);
      setError(e instanceof Error ? e.message : t('auth.errors.wrongCode'));
      setCode('');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (state === 'error') setState('idle');
    if (digits.length === LENGTH) verify(digits);
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await sendEmailCode(email);
      setInfo(t('auth.code.resent'));
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.errors.sendFailed'));
    }
  };

  const ok = state === 'ok';

  return (
    <Screen contentStyle={styles.content}>
      <BackButton />

      <View style={styles.head}>
        <Magne pose={ok ? 'jubler' : 'trekker'} size={88} />
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {ok ? t('auth.code.success') : t('auth.code.title')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('auth.code.sentTo', { email })}</Text>
      </View>

      <View style={styles.boxes}>
        <CodeBoxes
          value={code}
          onChangeText={onChange}
          length={LENGTH}
          state={state}
          shakeKey={shakeKey}
          editable={!checking && !ok}
          accessibilityLabel={t('auth.code.inputLabel')}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
        />
      </View>

      {checking ? <Text style={[styles.sub, styles.center, { color: tokens.textSecondary }]}>{t('auth.code.checking')}</Text> : null}
      <ErrorText>{error}</ErrorText>
      {info ? <Text style={[styles.sub, styles.center, { color: tokens.stamp }]}>{info}</Text> : null}

      {ok ? null : (
        <View style={styles.resendRow}>
          <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('auth.code.notReceived')} </Text>
          <Pressable
            onPress={resend}
            disabled={wait > 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: wait > 0 }}
            hitSlop={12}
            style={styles.resend}>
            <Text style={[styles.resendText, { color: wait > 0 ? tokens.textSecondary : tokens.text }]}>
              {wait > 0 ? t('auth.code.resendIn', { seconds: wait }) : t('auth.code.resend')}
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  head: { alignItems: 'center', gap: 6 },
  title: { fontFamily: FontFamily.hand, fontSize: 28, lineHeight: 32, textAlign: 'center' },
  sub: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  center: { textAlign: 'center' },
  boxes: { marginTop: 10 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', minHeight: 44 },
  resend: { minHeight: 44, justifyContent: 'center' },
  resendText: { fontFamily: FontFamily.bold, fontSize: 14, textDecorationLine: 'underline' },
});
