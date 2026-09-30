import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

/** Supabase's own minimum; matched here so the round trip is not spent on a length check. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Where the "Glemt passord" email lands: `<scheme>://reset-password#access_token=...`.
 * Supabase puts the recovery tokens in the URL's hash, which expo-router hands over as
 * the `#` search param; the full launch URL is the fallback for the cases where it does
 * not. Nothing is applied until the person has typed a new password - the tokens are
 * only ever used together with it, in finishPasswordReset.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { finishPasswordReset } = useAuth();
  const { '#': hash } = useLocalSearchParams<{ '#'?: string }>();
  const launchUrl = Linking.useURL();
  const recoveryUrl = hash ? `reset-password#${hash}` : (launchUrl ?? '');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Passordet må ha minst ${MIN_PASSWORD_LENGTH} tegn.`);
      return;
    }
    if (password !== confirm) {
      setError('Passordene er ikke like.');
      return;
    }
    setSubmitting(true);
    try {
      await finishPasswordReset(recoveryUrl, password);
      // The recovery session has signed them in by now - the navigator is already on its
      // way into the app, so this only has to say what happened and get out of the way.
      Alert.alert('Passordet er endret', 'Du er logget inn med det nye passordet.');
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

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
      <ThemedText style={[styles.title, { color: theme.text }]}>Nytt passord</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
        Velg et nytt passord for kontoen din. Du blir logget inn med en gang.
      </ThemedText>

      <View style={styles.form}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Nytt passord"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="password-new"
          autoFocus
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Gjenta passordet"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="password-new"
          onSubmitEditing={handleSubmit}
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <PrimaryButton
          label="Lagre passord"
          size="large"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!password || !confirm}
        />
      </View>

      {error && (
        <ThemedText type="small" themeColor="danger" style={styles.message}>
          {error}
        </ThemedText>
      )}

      <View style={styles.footer}>
        <PrimaryButton
          label="Tilbake til innlogging"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
          disabled={submitting}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  form: {
    marginTop: Spacing.five,
    gap: Spacing.two + Spacing.half,
  },
  input: {
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.three + Spacing.half,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  message: {
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.four,
  },
});
