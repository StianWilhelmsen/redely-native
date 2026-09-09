import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPermissionStatus, requestAndRegisterPushToken } from '@/lib/push-notifications';

const SNOOZE_KEY = 'redely.notification-prompt.snoozed-until';
const SNOOZE_DAYS = 7;
/** Long enough for Hjem to be on screen before a card lands on top of it. */
const SHOW_DELAY_MS = 1200;

type Props = {
  /** The prompt only makes sense once there is a collective to be notified about. */
  collectiveId: number | null | undefined;
};

/**
 * Our own ask before the OS's. iOS allows exactly one system prompt, and a "no" there is
 * final short of a trip to Settings - so we say in our words what the notifications are
 * for, and only trigger the system dialog on a yes. "Ikke nå" comes back a week later;
 * it is not a refusal, and the first evening in a new collective is not always the
 * moment people want to decide.
 *
 * Plain storage on purpose: the earlier keychain flag survived reinstalls on iOS, so a
 * device that had once tapped "Ikke nå" never saw the card again on any later install.
 */
export function NotificationPrompt({ collectiveId }: Props) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!collectiveId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const snoozedUntil = Number(await AsyncStorage.getItem(SNOOZE_KEY));
        if (snoozedUntil && Date.now() < snoozedUntil) return;
      } catch {
        // Unreadable storage is no reason to skip the ask.
      }
      // 'undetermined' is the only state where asking does anything: granted needs no
      // card, and a denial can only be undone in Settings (Varslingsinnstillinger links there).
      const { status } = await getPermissionStatus();
      if (cancelled || status !== 'undetermined') return;
      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, SHOW_DELAY_MS);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [collectiveId]);

  const snooze = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    } catch {
      // Worst case the card returns next launch.
    }
  };

  const handleAccept = async () => {
    setRequesting(true);
    try {
      await requestAndRegisterPushToken();
      setVisible(false);
    } catch (error) {
      console.warn('Could not enable push notifications', error);
      setVisible(false);
      Alert.alert(
        'Kunne ikke aktivere varsler',
        'Tillatelsen kan være gitt, men enheten kunne ikke registreres. Prøv igjen under Varslinger i innstillingene.'
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={snooze}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.brand}1F` }]}>
            <Ionicons name="notifications-outline" size={26} color={theme.brand} />
          </View>
          <ThemedText type="heading" style={styles.title}>
            Vil du tillate varsler fra oss?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Vi ønsker å varsle deg om oppgaver og chatter: når du får en ny oppgave, noen
            skriver i kollektivet, eller en utgift venter på deg. Du velger selv hva du vil ha
            under Varslinger i innstillingene.
          </ThemedText>
          <PrimaryButton label="Ja, varsle meg" onPress={handleAccept} loading={requesting} />
          <Pressable onPress={snooze} style={styles.laterButton} hitSlop={Spacing.two}>
            <ThemedText type="small" themeColor="textSecondary">
              Ikke nå
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radii.sheet,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.two,
  },
  laterButton: {
    paddingVertical: Spacing.one,
  },
});
