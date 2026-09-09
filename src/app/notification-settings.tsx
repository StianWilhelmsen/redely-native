import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import {
  getPermissionStatus,
  isNotificationPermissionGranted,
  requestAndRegisterPushToken,
} from '@/lib/push-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Row({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText type="small">{label}</ThemedText>
        {description && (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: theme.backgroundSelected, true: theme.brand }}
        thumbColor={Platform.OS === 'android' ? theme.backgroundElement : undefined}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, mutate: mutateMe } = useMe();

  const [osStatus, setOsStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getPermissionStatus().then((permission) =>
      setOsStatus(isNotificationPermissionGranted(permission) ? 'granted' : permission.status)
    );
  }, []);

  const osEnabled = osStatus === 'granted';

  const handleEnableOs = async () => {
    setRequesting(true);
    try {
      const status = await requestAndRegisterPushToken();
      setOsStatus(status);
      await mutateMe();
    } catch (error) {
      console.warn('Could not enable push notifications', error);
      Alert.alert(
        'Kunne ikke registrere enheten',
        'Systemtillatelsen kan være aktiv, men push-tjenesten kunne ikke registreres. Kontroller nettverk og appens push-oppsett.'
      );
    } finally {
      setRequesting(false);
    }
  };

  const updatePreference = async (
    key: 'notifyTasks' | 'notifyActivity' | 'notifyExpenses' | 'notifyChat',
    value: boolean
  ) => {
    if (!me) return;
    setSaving(key);
    try {
      await api.updateNotificationPreferences({
        notifyTasks: key === 'notifyTasks' ? value : me.notifyTasks,
        notifyActivity: key === 'notifyActivity' ? value : me.notifyActivity,
        notifyExpenses: key === 'notifyExpenses' ? value : me.notifyExpenses,
        notifyChat: key === 'notifyChat' ? value : me.notifyChat,
      });
      await mutateMe();
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText type="smallBold">Varslinger</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        {!osEnabled && (
          <Section title="Systemtillatelse" variant="eyebrow">
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.osBody}>
                {osStatus === 'denied'
                  ? 'Varslinger er avslått for Redely i systeminnstillingene. Aktiver dem der for å motta varsler.'
                  : 'Du må gi tillatelse for at appen skal kunne sende deg varsler.'}
              </ThemedText>
              <Pressable
                onPress={osStatus === 'denied' ? () => Linking.openSettings() : handleEnableOs}
                disabled={requesting}
                style={styles.enableRow}>
                <ThemedText type="smallBold" themeColor="brand">
                  {requesting
                    ? 'Ber om tillatelse…'
                    : osStatus === 'denied'
                      ? 'Åpne systeminnstillinger'
                      : 'Aktiver varslinger'}
                </ThemedText>
              </Pressable>
            </View>
          </Section>
        )}

        <Section title="Varslingstyper" variant="eyebrow">
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <Row
              label="Oppgaver"
              description="Når du får tildelt en ny oppgave"
              value={me?.notifyTasks ?? true}
              onChange={(v) => updatePreference('notifyTasks', v)}
              disabled={!osEnabled || saving === 'notifyTasks'}
            />
            <Separator />
            <Row
              label="Meldinger"
              description="Nye meldinger i felleschatten og direktemeldinger"
              value={me?.notifyChat ?? true}
              onChange={(v) => updatePreference('notifyChat', v)}
              disabled={!osEnabled || saving === 'notifyChat'}
            />
            <Separator />
            <Row
              label="Aktivitet"
              description="Oppgaveaktivitet og ukesoppsummering"
              value={me?.notifyActivity ?? true}
              onChange={(v) => updatePreference('notifyActivity', v)}
              disabled={!osEnabled || saving === 'notifyActivity'}
            />
            <Separator />
            <Row
              label="Utgifter"
              description="Når noen betaler deg tilbake"
              value={me?.notifyExpenses ?? true}
              onChange={(v) => updatePreference('notifyExpenses', v)}
              disabled={!osEnabled || saving === 'notifyExpenses'}
            />
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  card: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
  },
  osBody: {
    paddingTop: Spacing.three,
    lineHeight: 20,
  },
  enableRow: {
    paddingVertical: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
