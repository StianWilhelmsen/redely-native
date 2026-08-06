import * as Clipboard from 'expo-clipboard';
import { Fragment, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { StarterPack } from '@/types/api';

type Props = {
  starterPacks: StarterPack[];
  onApplied: () => void;
};

export function GetStartedSection({ starterPacks, onApplied }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [applyingPackId, setApplyingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailPack, setDetailPack] = useState<StarterPack | null>(null);

  const handleGetInvite = async () => {
    setCreatingInvite(true);
    setError(null);
    try {
      const invite = await api.createInvite();
      setInviteCode(invite.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt.');
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

  const handleApplyPack = async (packId: string) => {
    setApplyingPackId(packId);
    setError(null);
    try {
      await api.applyStarterPack(packId);
      onApplied();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Denne pakken er nok allerede lagt til denne uka.'
      );
    } finally {
      setApplyingPackId(null);
    }
  };

  return (
    <View style={styles.stack}>
      <Section title="Inviter noen du bor med">
        {inviteCode ? (
          <View style={styles.codeRow}>
            <ThemedText type="display" themeColor="brand" style={styles.code}>
              {inviteCode}
            </ThemedText>
            <PrimaryButton
              label={copied ? 'Kopiert!' : 'Kopier'}
              onPress={handleCopy}
              variant="secondary"
            />
          </View>
        ) : (
          <PrimaryButton label="Lag invitasjonskode" onPress={handleGetInvite} loading={creatingInvite} />
        )}
      </Section>

      <Section title="Kom i gang med en startpakke">
        <ThemedText type="small" themeColor="textSecondary">
          En ferdig ukeplan med oppgaver fordelt på alle i kollektivet.
        </ThemedText>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        <View>
          {starterPacks.map((pack, index) => (
            <Fragment key={pack.id}>
              {index > 0 && <Separator />}
              <View style={styles.packRow}>
                <Pressable
                  onPress={() => setDetailPack(pack)}
                  style={styles.packInfoPressable}
                  hitSlop={Spacing.two}>
                  <ThemedText style={styles.packEmoji}>{pack.emoji}</ThemedText>
                  <View style={styles.packInfo}>
                    <ThemedText type="smallBold">{pack.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {pack.tagline}
                    </ThemedText>
                  </View>
                </Pressable>
                <View style={styles.packButton}>
                  <PrimaryButton
                    label="Bruk"
                    onPress={() => handleApplyPack(pack.id)}
                    loading={applyingPackId === pack.id}
                    variant="secondary"
                  />
                </View>
              </View>
            </Fragment>
          ))}
        </View>
      </Section>

      <Modal
        visible={!!detailPack}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailPack(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailPack(null)}>
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.four },
            ]}
            onPress={(e) => e.stopPropagation()}>
            {detailPack && (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText style={styles.packEmoji}>{detailPack.emoji}</ThemedText>
                  <View style={styles.packInfo}>
                    <ThemedText type="smallBold">{detailPack.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {detailPack.tagline}
                    </ThemedText>
                  </View>
                </View>
                <Separator />
                <View style={styles.modalTaskList}>
                  {detailPack.tasks.map((task, index) => (
                    <Fragment key={task.title}>
                      {index > 0 && <Separator />}
                      <View style={styles.modalTaskRow}>
                        <ThemedText type="small">{task.title}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {task.description}
                        </ThemedText>
                      </View>
                    </Fragment>
                  ))}
                </View>
                <PrimaryButton
                  label="Bruk denne pakken"
                  onPress={() => {
                    setDetailPack(null);
                    handleApplyPack(detailPack.id);
                  }}
                  loading={applyingPackId === detailPack.id}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.five,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: {
    letterSpacing: 4,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  packEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  packInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  packInfoPressable: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  packButton: {
    flexShrink: 0,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.three,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  modalTaskList: {
    gap: 0,
  },
  modalTaskRow: {
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
