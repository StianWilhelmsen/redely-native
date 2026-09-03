import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { CollectiveAvatar } from '@/components/collective-avatar';
import { PillSegmentedControl } from '@/components/pill-segmented-control';
import { PaywallSheet } from '@/components/subscription/paywall-sheet';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { planForMemberLimit } from '@/constants/plans';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatInviteCode } from '@/lib/invite-code';
import { usePalette, type AppearanceMode } from '@/theme/palette-context';
import type { BillingStatus } from '@/types/api';

/** Days between now and an ISO instant, floored at zero. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function billingSummary(billing: BillingStatus | undefined): string {
  if (!billing) return '';
  if (billing.readOnly) return 'Utløpt';
  switch (billing.status) {
    case 'TRIALING': {
      const days = daysUntil(billing.trialEndsAt);
      return days == null ? 'Prøveperiode' : `Prøveperiode · ${days} dager`;
    }
    case 'PAST_DUE':
      return 'Betalingsproblem';
    case 'CANCELED':
      return 'Avsluttes snart';
    default:
      return planForMemberLimit(billing.maxMembers).name;
  }
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { mode, setMode } = usePalette();
  const { data: me, mutate: mutateMe } = useMe();

  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: billing } = useSWR(me?.collective ? 'billing-status' : null, api.billingStatus);
  const { data: weeklyStats } = useSWR(me?.collective ? 'weekly-stats' : null, api.weeklyStats);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const memberCount = members?.length ?? 0;

  /** Fetched on demand: a code is only worth minting when someone asks to see it. */
  const handleInvitePress = async () => {
    if (inviteCode) {
      await Clipboard.setStringAsync(formatInviteCode(inviteCode));
      Alert.alert('Kopiert', 'Invitasjonskoden ligger på utklippstavla.');
      return;
    }
    setLoadingInvite(true);
    try {
      const invite = await api.createInvite();
      setInviteCode(invite.code);
    } catch (err) {
      Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Prøv igjen senere.');
    } finally {
      setLoadingInvite(false);
    }
  };

  /**
   * Two prompts, and the second says what actually disappears rather than asking
   * "are you sure?" a second time. Required by App Store guideline 5.1.1(v): an app that
   * lets you create an account has to let you delete it from inside the app.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Slette brukeren din?',
      'Profilen, meldingene og utgiftene dine blir borte for godt. Dette kan ikke angres.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Helt sikker?', 'Siste sjanse — brukeren slettes permanent.', [
              { text: 'Avbryt', style: 'cancel' },
              {
                text: 'Slett brukeren',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true);
                  try {
                    await api.deleteAccount();
                    // The account is gone, so the session is meaningless - signing out
                    // drops the tokens and sends the navigator back to sign-in.
                    await signOut();
                  } catch (err) {
                    Alert.alert(
                      'Kunne ikke slette brukeren',
                      err instanceof Error ? err.message : 'Prøv igjen, eller kontakt oss.'
                    );
                  } finally {
                    setDeleting(false);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Forlat kollektivet',
      'Oppgaver du er tildelt blir tildelt på nytt. Du kan bli med igjen med en ny kode.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Forlat',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await api.leaveCollective();
              // Losing the collective sends the navigator back into onboarding on its own.
              await mutateMe();
            } catch (err) {
              Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Prøv igjen senere.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.three}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.navTitle, { color: theme.text }]}>Innstillinger</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        showsVerticalScrollIndicator={false}>
        {me?.collective && (
          <>
            <ThemedText type="eyebrow" style={styles.groupLabel}>
              Kollektivet
            </ThemedText>

            <View style={styles.collectiveRow}>
              <CollectiveAvatar pictureUrl={me.collective.pictureUrl} size={44} />
              <View style={styles.collectiveText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {me.collective.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {memberCount} {memberCount === 1 ? 'medlem' : 'medlemmer'}
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/collective-settings')}
                hitSlop={Spacing.two}>
                <ThemedText type="smallBold" themeColor="brand">
                  Endre
                </ThemedText>
              </Pressable>
            </View>

            <SettingsGroup>
              <SettingsRow
                label="Invitasjonskode"
                value={
                  loadingInvite ? 'Henter…' : inviteCode ? formatInviteCode(inviteCode) : 'Vis kode'
                }
                onPress={handleInvitePress}
              />
              <SettingsRow
                label="Ukeplan"
                value="Bytt pakke"
                onPress={() => router.push('/starter-pack')}
              />
              <SettingsRow
                label="Ukemål"
                value={weeklyStats ? `${weeklyStats.goalPoints} poeng` : ''}
              />
              <SettingsRow
                label="Abonnement"
                value={billingSummary(billing)}
                onPress={() => setPaywallVisible(true)}
                last
              />
            </SettingsGroup>
          </>
        )}

        <ThemedText type="eyebrow" style={styles.groupLabel}>
          Deg
        </ThemedText>
        <SettingsGroup>
          <SettingsRow
            label="Navn og bilde"
            value={me?.name}
            onPress={() => router.push('/profile')}
          />
          <SettingsRow
            label="Varslinger"
            value={me?.notifyTasks || me?.notifyChat ? 'På' : 'Av'}
            onPress={() => router.push('/notification-settings')}
            last
          />
        </SettingsGroup>

        <ThemedText type="eyebrow" style={styles.groupLabel}>
          Utseende
        </ThemedText>
        <PillSegmentedControl<AppearanceMode>
          options={[
            { key: 'light', label: 'Lys' },
            { key: 'dark', label: 'Mørk' },
            { key: 'system', label: 'Auto' },
          ]}
          value={mode}
          onChange={setMode}
        />

        <ThemedText type="eyebrow" style={styles.groupLabel}>
          Om
        </ThemedText>
        <SettingsGroup>
          {/* Guideline 5.1.1(i) wants the privacy policy reachable "within the app in an
              easily accessible manner" - so it lives here, not behind the paywall. */}
          <SettingsRow label="Vilkår for bruk" onPress={() => router.push(TERMS_ROUTE)} />
          <SettingsRow label="Personvernerklæring" onPress={() => router.push(PRIVACY_ROUTE)} last />
        </SettingsGroup>

        <View style={styles.actions}>
          <Pressable onPress={signOut} hitSlop={Spacing.two} style={styles.action}>
            <ThemedText type="small" themeColor="textSecondary">
              Logg ut
            </ThemedText>
          </Pressable>

          {me?.collective && (
            <Pressable
              onPress={handleLeave}
              disabled={leaving}
              hitSlop={Spacing.two}
              style={styles.action}>
              <ThemedText type="small" themeColor="danger">
                {leaving ? 'Forlater…' : 'Forlat kollektivet'}
              </ThemedText>
            </Pressable>
          )}

          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleting}
            hitSlop={Spacing.two}
            style={styles.action}>
            <ThemedText type="small" themeColor="danger">
              {deleting ? 'Sletter…' : 'Slett brukeren min'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </View>
  );
}

/** A run of rows bounded by hairlines, sitting straight on the background. */
function SettingsGroup({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <View style={[styles.hairline, { backgroundColor: theme.border }]} />
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.rowLabel} numberOfLines={1}>
          {label}
        </ThemedText>
        {!!value && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.rowValue}>
            {value}
          </ThemedText>
        )}
        {onPress && <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />}
      </Pressable>
      {!last && <View style={[styles.hairline, { backgroundColor: theme.border }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  content: {
    paddingHorizontal: Spacing.four,
  },
  groupLabel: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  collectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  collectiveText: {
    flex: 1,
    minWidth: 0,
  },
  group: {
    marginBottom: Spacing.one,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  rowLabel: {
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    marginTop: Spacing.five,
    gap: Spacing.three,
  },
  action: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
});
