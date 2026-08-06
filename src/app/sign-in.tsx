import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const { signIn, signInError } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(false);

  const handleSignIn = async () => {
    setPending(true);
    try {
      await signIn();
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.brand }]}>
      <View style={[styles.hero, { paddingTop: insets.top + Spacing.six }]}>
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

        <Pressable
          onPress={handleSignIn}
          disabled={pending}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.brand },
            pressed && styles.buttonPressed,
          ]}>
          {pending ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <ThemedText type="smallBold" themeColor="onBrand" style={styles.buttonText}>
              Kom i gang
            </ThemedText>
          )}
        </Pressable>

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
    gap: Spacing.five,
    paddingHorizontal: Spacing.five,
  },
  mark: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
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
  button: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
  },
  footnote: {
    textAlign: 'center',
  },
});
