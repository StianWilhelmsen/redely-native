import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaletteSwitcher } from '@/components/palette-switcher';
import { PrimaryButton } from '@/components/primary-button';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.rowRight}>
        {value && (
          <ThemedText type="small" numberOfLines={1} style={styles.rowValue}>
            {value}
          </ThemedText>
        )}
        {onPress && <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data: me, mutate: mutateMe } = useMe();

  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /**
   * Two-step confirmation before a permanent, irreversible delete - the second prompt
   * spells out what actually disappears rather than just asking "are you sure?" again.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Slette kontoen din?',
      'Profilen, meldingene og utgiftene dine blir borte for godt. Dette kan ikke angres.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Helt sikker?', 'Siste sjanse — kontoen slettes permanent.', [
              { text: 'Avbryt', style: 'cancel' },
              { text: 'Slett kontoen', style: 'destructive', onPress: confirmDeleteAccount },
            ]);
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      // The account is gone, so the session is meaningless - signing out drops the local
      // tokens and sends the navigator back to the sign-in screen.
      await signOut();
    } catch (err) {
      Alert.alert(
        'Kunne ikke slette kontoen',
        err instanceof Error ? err.message : 'Prøv igjen, eller kontakt oss om det vedvarer.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const startEditingName = () => {
    setName(me?.name ?? '');
    setNameError(null);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Navn kan ikke være tomt.');
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await api.updateProfileName(trimmed);
      await mutateMe();
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText type="smallBold">Innstillinger</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        <Section title="Konto">
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {editingName ? (
              <View style={styles.editColumn}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  autoFocus
                />
                {nameError && (
                  <ThemedText type="small" themeColor="danger">
                    {nameError}
                  </ThemedText>
                )}
                <View style={styles.editActions}>
                  <PrimaryButton label="Lagre" onPress={handleSaveName} loading={savingName} />
                  <PrimaryButton label="Avbryt" variant="secondary" onPress={() => setEditingName(false)} />
                </View>
              </View>
            ) : (
              <Row label="Navn" value={me?.name} onPress={startEditingName} />
            )}
            <Separator />
            <Row label="E-post" value={me?.email} />
          </View>
        </Section>

        <Section title="Kollektiv">
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <Row
              label="Kollektivinnstillinger"
              value={me?.collective ? me.collective.name : 'Ingen kollektiv'}
              onPress={() => router.push('/collective-settings')}
            />
          </View>
        </Section>

        <Section title="Varslinger">
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <Row label="Varslingsinnstillinger" onPress={() => router.push('/notification-settings')} />
          </View>
        </Section>

        <Section title="Utseende">
          <PaletteSwitcher />
        </Section>

        <Section title="Om">
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {/* Guideline 5.1.1(i) wants the privacy policy reachable "within the app in an
                easily accessible manner" - behind the paywall isn't that, since someone who
                never opens it would never find it. */}
            <Row label="Vilkår for bruk" onPress={() => router.push(TERMS_ROUTE)} />
            <Separator />
            <Row label="Personvernerklæring" onPress={() => router.push(PRIVACY_ROUTE)} />
            <Separator />
            <Row label="Versjon" value="1.0.0" />
          </View>
        </Section>

        <PrimaryButton label="Logg ut" variant="danger" onPress={signOut} />

        <Section title="Farlig sone">
          <ThemedText type="small" themeColor="textSecondary" style={styles.deleteBlurb}>
            Sletting fjerner profilen din, meldingene dine og utgiftene du har lagt ut. Er du
            alene i kollektivet, slettes kollektivet også. Dette kan ikke angres.
          </ThemedText>
          <PrimaryButton
            label={deleting ? 'Sletter…' : 'Slett konto'}
            variant="danger"
            loading={deleting}
            onPress={handleDeleteAccount}
          />
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
  deleteBlurb: {
    marginBottom: Spacing.two,
    lineHeight: 19,
  },
  card: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  rowValue: {
    flexShrink: 1,
  },
  editColumn: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
});
