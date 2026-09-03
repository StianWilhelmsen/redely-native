import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { PrimaryButton } from '@/components/primary-button';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { StarterPack } from '@/types/api';

export default function StarterPackScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: starterPacks } = useSWR('starter-packs', api.starterPacks);

  const [applyingPackId, setApplyingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedPackId, setAppliedPackId] = useState<string | null>(null);
  const [detailPack, setDetailPack] = useState<StarterPack | null>(null);

  const handleApplyPack = async (packId: string) => {
    setApplyingPackId(packId);
    setError(null);
    try {
      await api.applyStarterPack(packId);
      setAppliedPackId(packId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setApplyingPackId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText type="smallBold">Startpakke</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        <Section title="Bytt startpakke" variant="eyebrow">
          <ThemedText type="small" themeColor="textSecondary">
            Velg en ny pakke for å bytte ut denne ukas ufullførte startpakke-oppgaver. Allerede
            fullførte oppgaver og poeng beholdes.
          </ThemedText>
        </Section>

        {appliedPackId && (
          <ThemedText type="small" themeColor="brand">
            Pakken er lagt til. Gå tilbake for å se den nye ukeplanen.
          </ThemedText>
        )}
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {starterPacks?.map((pack, index) => (
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
                    label={appliedPackId === pack.id ? 'Valgt' : 'Bruk'}
                    onPress={() => handleApplyPack(pack.id)}
                    loading={applyingPackId === pack.id}
                    variant="secondary"
                  />
                </View>
              </View>
            </Fragment>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={!!detailPack}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailPack(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailPack(null)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.four }]}
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
                <ScrollView style={styles.modalTaskList}>
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
                </ScrollView>
                <PrimaryButton
                  label={appliedPackId === detailPack.id ? 'Valgt' : 'Bruk denne pakken'}
                  onPress={() => handleApplyPack(detailPack.id)}
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
    flexGrow: 0,
  },
  modalTaskRow: {
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
