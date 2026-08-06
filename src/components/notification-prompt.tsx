import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPermissionStatus, requestAndRegisterPushToken } from '@/lib/push-notifications';

const DISMISSED_KEY = 'ryddig-kollektiv.notif-prompt-shown';

/**
 * One-time, custom pre-permission prompt shown after onboarding. We ask in our
 * own words first (rather than throwing the OS dialog at people cold) - if they
 * say yes, only then do we trigger the real system permission request.
 */
export function NotificationPrompt() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const alreadyShown = await SecureStore.getItemAsync(DISMISSED_KEY);
      if (alreadyShown) return;
      const { status } = await getPermissionStatus();
      if (!cancelled && status === 'undetermined') {
        setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    await SecureStore.setItemAsync(DISMISSED_KEY, '1');
    setVisible(false);
  };

  const handleAccept = async () => {
    setRequesting(true);
    try {
      await requestAndRegisterPushToken();
    } finally {
      setRequesting(false);
      await dismiss();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.brand}1F` }]}>
            <Ionicons name="notifications-outline" size={26} color={theme.brand} />
          </View>
          <ThemedText type="heading" style={styles.title}>
            Ønsker du å motta varslinger?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Vi varsler deg når du får en ny oppgave, noen fullfører noe i kollektivet, eller når det
            legges til en ny utgift.
          </ThemedText>
          <PrimaryButton label="Ja, varsle meg" onPress={handleAccept} loading={requesting} />
          <Pressable onPress={dismiss} style={styles.laterButton} hitSlop={Spacing.two}>
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
