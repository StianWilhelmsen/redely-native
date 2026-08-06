import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { PrimaryButton } from '@/components/primary-button';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
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

export default function CollectiveSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, mutate: mutateMe } = useMe();

  const { data: members, mutate: mutateMembers } = useSWR(me?.collective ? 'members' : null, api.members);

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
