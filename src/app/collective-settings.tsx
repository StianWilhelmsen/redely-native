import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { PrimaryButton } from '@/components/primary-button';
import { Section, Separator } from '@/components/section';
import { PaywallSheet } from '@/components/subscription/paywall-sheet';
import { ThemedText } from '@/components/themed-text';
import { planForMemberLimit } from '@/constants/plans';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { BillingStatus } from '@/types/api';

/** Short summary shown as the "Abonnement" row's value - detail lives in the sheet.
 *  Names the plan rather than quoting a price: once you're paying, what you have is more
 *  useful at a glance than what it costs, and the price is one tap away in the sheet. */
function billingSummary(billing?: BillingStatus): string {
  if (!billing) return '';
  if (billing.readOnly) return 'Utløpt';
  switch (billing.status) {
    case 'TRIALING':
      return 'Prøveperiode';
    case 'PAST_DUE':
      return 'Betalingsproblem';
    case 'CANCELED':
      return 'Avsluttes snart';
    default:
      return planForMemberLimit(billing.maxMembers).name;
  }
}

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

export default function CollectiveSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, mutate: mutateMe } = useMe();
  const { mutate: globalMutate } = useSWRConfig();

  const { data: members, mutate: mutateMembers } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: billing } = useSWR(me?.collective ? 'billing-status' : null, api.billingStatus);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const handlePickCollectivePicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til bilder for å sette kollektivbilde.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);

    setUploadingPicture(true);
    try {
      await api.updateCollectivePicture({ uri: asset.uri, name: asset.fileName ?? `collective.${ext}`, type });
      await mutateMe();
      globalMutate('weekly-stats');
    } catch (err) {
      Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Kunne ikke laste opp bildet.');
    } finally {
      setUploadingPicture(false);
    }
  };

  const [collectiveName, setCollectiveName] = useState('');
  const [editingCollectiveName, setEditingCollectiveName] = useState(false);
  const [savingCollectiveName, setSavingCollectiveName] = useState(false);
  const [collectiveNameError, setCollectiveNameError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const startEditingCollectiveName = () => {
    setCollectiveName(me?.collective?.name ?? '');
    setCollectiveNameError(null);
    setEditingCollectiveName(true);
  };

  const handleSaveCollectiveName = async () => {
    const trimmed = collectiveName.trim();
    if (!trimmed) {
      setCollectiveNameError('Navn kan ikke være tomt.');
      return;
    }
    setSavingCollectiveName(true);
    setCollectiveNameError(null);
    try {
      await api.renameCollective(trimmed);
      await mutateMe();
      setEditingCollectiveName(false);
    } catch (err) {
      setCollectiveNameError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setSavingCollectiveName(false);
    }
  };

  const handleRemoveMember = (memberId: number, memberName: string) => {
    Alert.alert('Fjern medlem', `Vil du fjerne ${memberName} fra kollektivet?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Fjern',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(memberId);
          try {
            await api.removeMember(memberId);
            await mutateMembers();
          } catch (err) {
            Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Prøv igjen senere.');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  const handleGetInvite = async () => {
    setCreatingInvite(true);
    try {
      const invite = await api.createInvite();
      setInviteCode(invite.code);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLeaveCollective = () => {
    Alert.alert(
      'Forlat kollektiv',
      'Er du sikker på at du vil forlate kollektivet? Oppgaver du er tildelt blir tildelt på nytt.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Forlat',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await api.leaveCollective();
              setInviteCode(null);
              await mutateMe();
              router.back();
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
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText type="smallBold">Kollektivinnstillinger</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        <Section title="Kollektiv">
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {me?.collective ? (
              <>
                <View style={styles.pictureRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Endre kollektivbilde"
                    onPress={me.admin ? handlePickCollectivePicture : undefined}
                    disabled={!me.admin || uploadingPicture}
                    style={styles.pictureWrap}>
                    <CollectiveAvatar pictureUrl={me.collective.pictureUrl} size={64} />
                    {me.admin && (
                      <View
                        style={[
                          styles.pictureEditBadge,
                          { backgroundColor: theme.brand, borderColor: theme.backgroundElement },
                        ]}>
                        {uploadingPicture ? (
                          <ActivityIndicator size="small" color={theme.onBrand} />
                        ) : (
                          <Ionicons name="camera" size={12} color={theme.onBrand} />
                        )}
                      </View>
                    )}
                  </Pressable>
                  {!me.admin && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.pictureHint}>
                      Bare en admin kan endre kollektivbildet.
                    </ThemedText>
                  )}
                </View>
                <Separator />
                {editingCollectiveName ? (
                  <View style={styles.editColumn}>
                    <TextInput
                      value={collectiveName}
                      onChangeText={setCollectiveName}
                      style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                      autoFocus
                    />
                    {collectiveNameError && (
                      <ThemedText type="small" themeColor="danger">
                        {collectiveNameError}
                      </ThemedText>
                    )}
                    <View style={styles.editActions}>
                      <PrimaryButton label="Lagre" onPress={handleSaveCollectiveName} loading={savingCollectiveName} />
                      <PrimaryButton
                        label="Avbryt"
                        variant="secondary"
                        onPress={() => setEditingCollectiveName(false)}
                      />
                    </View>
                  </View>
                ) : (
                  <Row
                    label="Navn"
                    value={me.collective.name}
                    onPress={me.admin ? startEditingCollectiveName : undefined}
                  />
                )}
                <Separator />
                <View style={styles.inviteRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Invitasjonskode
                  </ThemedText>
                  {inviteCode ? (
                    <Pressable onPress={handleCopy} style={styles.inviteCodeRow}>
                      <ThemedText type="smallBold" style={styles.inviteCode}>
                        {inviteCode}
                      </ThemedText>
                      <ThemedText type="small" themeColor="brand">
                        {copied ? 'Kopiert!' : 'Kopier'}
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable onPress={handleGetInvite} disabled={creatingInvite}>
                      <ThemedText type="small" themeColor="brand">
                        {creatingInvite ? 'Lager…' : 'Lag kode'}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
                <Separator />
                <Row label="Startpakke" value="Bytt pakke" onPress={() => router.push('/starter-pack')} />
                <Separator />
                <Row label="Abonnement" value={billingSummary(billing)} onPress={() => setPaywallVisible(true)} />
                <Separator />
                <Pressable disabled={leaving} onPress={handleLeaveCollective} style={styles.row}>
                  <ThemedText type="small" themeColor="danger">
                    {leaving ? 'Forlater…' : 'Forlat kollektiv'}
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyRow}>
                Du er ikke med i et kollektiv ennå.
              </ThemedText>
            )}
          </View>
        </Section>

        {me?.collective && members && members.length > 0 && (
          <Section title="Medlemmer">
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              {members.map((member, index) => (
                <View key={member.id}>
                  {index > 0 && <Separator />}
                  <View style={styles.memberRow}>
                    <AvatarBadge
                      userId={member.id}
                      name={member.name}
                      pictureUrl={member.pictureUrl}
                      shape="circle"
                      size={36}
                    />
                    <View style={styles.memberInfo}>
                      <ThemedText type="small" numberOfLines={1}>
                        {member.name}
                      </ThemedText>
                      {member.admin && (
                        <ThemedText type="small" themeColor="brand">
                          Admin
                        </ThemedText>
                      )}
                    </View>
                    {me.admin && member.id !== me.id && (
                      <Pressable
                        disabled={removingId === member.id}
                        onPress={() => handleRemoveMember(member.id, member.name)}
                        hitSlop={Spacing.two}>
                        <ThemedText type="small" themeColor="danger">
                          {removingId === member.id ? 'Fjerner…' : 'Fjern'}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>

      <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  pictureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pictureWrap: {
    position: 'relative',
  },
  pictureEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pictureHint: {
    flex: 1,
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
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inviteCode: {
    letterSpacing: 2,
  },
  emptyRow: {
    paddingVertical: Spacing.three,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
});
