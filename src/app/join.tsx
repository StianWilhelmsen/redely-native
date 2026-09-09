import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import useSWR from 'swr';

import { PrimaryButton } from '@/components/primary-button';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/lib/invite-code';
import { setPendingInviteCode } from '@/lib/pending-invite';

/**
 * Where a scanned QR code lands: `<scheme>://join?code=XXXXX`. Nothing is joined here -
 * the code is handed to whichever screen can act on it. Signed out, that is after
 * sign-in; signed in without a collective, onboarding's join step picks it up and joins
 * straight away. Someone already in a collective is told so rather than moved.
 *
 * Ungated in the root stack on purpose: a deep link has to be reachable before the app
 * knows who is opening it.
 */
export default function JoinScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code?: string | string[] }>();
  const code = normalizeInviteCode(Array.isArray(rawCode) ? (rawCode[0] ?? '') : (rawCode ?? ''));
  const { status } = useAuth();
  const { data: me } = useSWR(status === 'signedIn' ? 'me' : null, api.me);

  const alreadyInCollective = status === 'signedIn' && !!me?.collective;

  useEffect(() => {
    if (status === 'loading') return;
    if (code.length < INVITE_CODE_LENGTH) {
      router.replace('/');
      return;
    }
    if (status === 'signedOut') {
      setPendingInviteCode(code);
      router.replace('/sign-in');
      return;
    }
    if (!me || me.collective) return;
    setPendingInviteCode(code);
    router.replace('/onboarding');
  }, [status, me, code]);

  return (
    <ThemedView style={styles.root}>
      {alreadyInCollective ? (
        <>
          <ThemedText type="heading" style={styles.text}>
            Du er allerede med i {me?.collective?.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
            Vil du bytte kollektiv, må du først forlate det du er i, under Innstillinger.
          </ThemedText>
          <PrimaryButton label="Til appen" onPress={() => router.replace('/')} />
        </>
      ) : (
        <RefreshSpinner active />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  text: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
