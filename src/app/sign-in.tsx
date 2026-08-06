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

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword, signInError } =
    useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingProvider, setPendingProvider] = useState<'google' | 'apple' | 'password' | null>(
    null
  );

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
    try {
      await (mode === 'signIn'
        ? signInWithPassword(email, password)
        : signUpWithPassword(email, password));
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

          {Platform.OS === 'ios' && (
            <Pressable
              onPress={() => handleOAuth('apple')}
              disabled={pending}
              style={({ pressed }) => [
                styles.oauthButton,
                styles.appleButton,
                pressed && styles.buttonPressed,
                pending && styles.disabled,
              ]}>
              {pendingProvider === 'apple' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText type="smallBold" style={styles.appleButtonText}>
                   Fortsett med Apple
                </ThemedText>
              )}
            </Pressable>
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
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
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
