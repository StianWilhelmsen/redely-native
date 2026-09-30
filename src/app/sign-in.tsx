import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { usePalette } from '@/theme/palette-context';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    signInError,
  } = useAuth();
  const theme = useTheme();
  const { scheme } = usePalette();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingProvider, setPendingProvider] = useState<
    'google' | 'apple' | 'password' | 'reset' | null
  >(null);
  /** Non-error feedback: "we sent you a confirmation mail" or "we sent you a reset link". */
  const [notice, setNotice] = useState<string | null>(null);
  /** Problems raised on this screen rather than by the auth context (the reset flow). */
  const [localError, setLocalError] = useState<string | null>(null);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setPendingProvider(provider);
    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithApple());
    } finally {
      setPendingProvider(null);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    setNotice(null);
    setLocalError(null);
    if (!trimmed) {
      setLocalError('Skriv inn e-posten din over, så sender vi deg en lenke.');
      return;
    }
    setPendingProvider('reset');
    try {
      await sendPasswordReset(trimmed);
      setNotice(
        `Vi har sendt en lenke til ${trimmed}. Åpne den på denne telefonen for å velge et nytt passord.`
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Klarte ikke å sende e-posten. Prøv igjen.');
    } finally {
      setPendingProvider(null);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!email || !password) return;
    setPendingProvider('password');
    setNotice(null);
    setLocalError(null);
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
  const submitDisabled = pending || !email || !password;
  const errorMessage = signInError ?? localError;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}>
      <Image source={require('@/assets/logo.png')} style={styles.mark} contentFit="contain" />

      <ThemedText style={[styles.title, { color: theme.text }]}>Redely</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.pitch}>
        Oppgaver, handleliste og utgifter – samlet for deg og de du bor med.
      </ThemedText>

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

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled }}
          onPress={handlePasswordSubmit}
          disabled={submitDisabled}
          style={({ pressed }) => [
            styles.control,
            styles.primaryButton,
            { backgroundColor: theme.brand },
            submitDisabled && styles.disabled,
            pressed && !submitDisabled && styles.pressed,
          ]}>
          {pendingProvider === 'password' ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <ThemedText style={[styles.controlLabel, { color: theme.onBrand }]}>
              {mode === 'signIn' ? 'Logg inn' : 'Opprett konto'}
            </ThemedText>
          )}
        </Pressable>
      </View>

      {errorMessage && (
        <ThemedText type="small" themeColor="danger" style={styles.message}>
          {errorMessage}
        </ThemedText>
      )}
      {notice && !errorMessage && (
        <ThemedText type="small" themeColor="brand" style={styles.message}>
          {notice}
        </ThemedText>
      )}

      {mode === 'signIn' && (
        <Pressable
          accessibilityRole="button"
          onPress={handleForgotPassword}
          disabled={pending}
          hitSlop={Spacing.two}
          style={[styles.toggle, pending && styles.disabled]}>
          <ThemedText type="small" themeColor="textSecondary">
            {pendingProvider === 'reset' ? 'Sender lenke…' : 'Glemt passord?'}
          </ThemedText>
        </Pressable>
      )}

      <Pressable
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setLocalError(null);
        }}
        hitSlop={Spacing.two}
        style={styles.toggle}>
        <ThemedText type="small" themeColor="textSecondary">
          {mode === 'signIn' ? 'Ny her? ' : 'Har du konto? '}
          <ThemedText type="smallBold" themeColor="brand">
            {mode === 'signIn' ? 'Opprett konto' : 'Logg inn'}
          </ThemedText>
        </ThemedText>
      </Pressable>

      {/* Pushes the provider buttons to the bottom of the screen, and collapses first when
          the keyboard takes the space. */}
      <View style={styles.spacer} />

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <ThemedText type="small" themeColor="textSecondary">
          eller
        </ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <View style={styles.providers}>
        {/* Apple's own button component, not a look-alike: guideline 4 requires Sign in
            with Apple to use the system-provided control, which also localises its label
            and follows the device appearance on its own. Only its geometry is ours, so it
            lines up with the Google button below. */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={Control.radius}
            style={[styles.appleButton, pending && styles.disabled]}
            onPress={() => {
              if (!pending) handleOAuth('apple');
            }}
          />
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => handleOAuth('google')}
          disabled={pending}
          style={({ pressed }) => [
            styles.control,
            styles.providerButton,
            { borderColor: theme.border, backgroundColor: theme.background },
            pending && styles.disabled,
            pressed && !pending && styles.pressed,
          ]}>
          {pendingProvider === 'google' ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <ThemedText style={[styles.controlLabel, { color: theme.text }]}>
              Fortsett med Google
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
  },
  mark: {
    width: 36,
    height: 36,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 41,
    marginTop: Spacing.four + Spacing.one,
  },
  pitch: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  form: {
    marginTop: Spacing.five,
    gap: Spacing.two + Spacing.half,
  },
  control: {
    height: Control.height,
    borderRadius: Control.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  input: {
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.three + Spacing.half,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  primaryButton: {
    marginTop: Spacing.one,
  },
  message: {
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  toggle: {
    marginTop: Spacing.four,
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.six,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  providers: {
    gap: Spacing.two + Spacing.half,
  },
  // Height only - AppleAuthenticationButton paints its own background and corners
  // (cornerRadius prop), and rejects backgroundColor/borderRadius in `style`.
  appleButton: {
    width: '100%',
    height: Control.height,
  },
  providerButton: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
