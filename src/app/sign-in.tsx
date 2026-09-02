import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { usePalette } from '@/theme/palette-context';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword, signInError } =
    useAuth();
  const theme = useTheme();
  const { scheme } = usePalette();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingProvider, setPendingProvider] = useState<'google' | 'apple' | 'password' | null>(
    null
  );
  /** Non-error feedback - currently only "we sent you a confirmation mail". */
  const [notice, setNotice] = useState<string | null>(null);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setPendingProvider(provider);
    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithApple());
    } finally {
      setPendingProvider(null);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!email || !password) return;
    setPendingProvider('password');
    setNotice(null);
    try {
      if (mode === 'signIn') {
        await signInWithPassword(email, password);
      } else {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password);
        // A successful sign-up that needs confirmation changes nothing on screen - no
        // session, no error, no navigation - so without this the button looks broken.
        if (needsEmailConfirmation) {
          setNotice(
            `Vi har sendt en bekreftelseslenke til ${email}. Åpne den for å fullføre, og logg deretter inn.`
          );
          setMode('signIn');
          setPassword('');
        }
      }
    } catch {
      // signInError is already set by the context - nothing else to do here.
    } finally {
      setPendingProvider(null);
    }
  };

  const pending = pendingProvider !== null;

  return (
    <View style={[styles.container, { backgroundColor: theme.brand }]}>
      <View style={[styles.hero, { paddingTop: insets.top + Spacing.four }]}>
        <Image source={require('@/assets/logo.png')} style={styles.mark} contentFit="contain" />
        <ThemedText type="display" themeColor="onBrand" style={styles.title}>
          Ryddig{'\n'}Kollektiv
        </ThemedText>
      </View>

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.five },
        ]}>
        <View style={styles.sheetText}>
          <ThemedText type="heading" style={styles.pitch}>
            Et ryddigere kollektiv, uten mas
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pitchBody}>
            Oppgaver, poeng og felles utgifter — samlet på ett sted for deg og de du bor med.
          </ThemedText>
        </View>

        {signInError && (
          <ThemedText type="small" themeColor="danger" style={styles.error}>
            {signInError}
          </ThemedText>
        )}

        {notice && !signInError && (
          <ThemedText type="small" themeColor="brand" style={styles.error}>
            {notice}
          </ThemedText>
        )}

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-post"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Passord"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete={mode === 'signIn' ? 'password' : 'password-new'}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />

          <PrimaryButton
            label={mode === 'signIn' ? 'Logg inn' : 'Opprett konto'}
            onPress={handlePasswordSubmit}
            loading={pendingProvider === 'password'}
            disabled={pending || !email || !password}
          />

          <Pressable
            onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
            hitSlop={Spacing.two}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.toggleText}>
              {mode === 'signIn' ? 'Ny bruker? Opprett konto' : 'Har du konto? Logg inn'}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <ThemedText type="small" themeColor="textSecondary">
            eller
          </ThemedText>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.oauthGroup}>
          <Pressable
            onPress={() => handleOAuth('google')}
            disabled={pending}
            style={({ pressed }) => [
              styles.oauthButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.buttonPressed,
              pending && styles.disabled,
            ]}>
            {pendingProvider === 'google' ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <ThemedText type="smallBold">Fortsett med Google</ThemedText>
            )}
          </Pressable>

          {/* Apple's own button component, not a look-alike: guideline 4 requires Sign in
              with Apple to use the system-provided control, which also localises its label
              and follows the device appearance on its own. */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={27}
              style={[styles.appleButton, pending && styles.disabled]}
              onPress={() => {
                if (!pending) handleOAuth('apple');
              }}
            />
          )}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          Gratis for kollektivet ditt
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  mark: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  sheetText: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  pitch: {
    textAlign: 'center',
  },
  pitchBody: {
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },
  error: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  toggleText: {
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  oauthGroup: {
    gap: Spacing.two,
  },
  oauthButton: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Height only - AppleAuthenticationButton paints its own background and corners
  // (cornerRadius prop), and rejects backgroundColor/borderRadius in `style`.
  appleButton: {
    width: '100%',
    height: 54,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  footnote: {
    textAlign: 'center',
  },
});
