import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/date-utils';
import { buildSettlements, formatKr, netBalance, type Settlement } from '@/lib/settlements';

export default function BalanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { data: expenses, error, mutate: mutateExpenses, isLoading } = useSWR('expenses', api.expenses);
  const dingPlayer = useAudioPlayer(require('@/assets/ding-sfx.mp3'));

  const [settlingId, setSettlingId] = useState<number | null>(null);

  const settlements = buildSettlements(expenses ?? [], me?.id);
  const balance = netBalance(settlements);

  const handleSettle = (settlement: Settlement) => {
    Alert.alert(
      `Gjøre opp med ${settlement.name}?`,
      `Marker ${formatKr(Math.abs(settlement.net))} som betalt. Gjør dette når pengene faktisk er overført.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Marker som betalt',
          onPress: async () => {
            setSettlingId(settlement.personId);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            dingPlayer.seekTo(0);
            dingPlayer.play();

            const settled = new Set(settlement.shareIds);
            try {
              await mutateExpenses(
                async (current) => {
                  for (const shareId of settlement.shareIds) {
                    await api.markSharePaid(shareId);
                  }
                  return (current ?? []).map((expense) => ({
                    ...expense,
                    shares: expense.shares.map((s) =>
                      settled.has(s.id) ? { ...s, paid: true, paidAt: new Date().toISOString() } : s
                    ),
                  }));
                },
                {
                  optimisticData: (current) =>
                    (current ?? []).map((expense) => ({
                      ...expense,
                      shares: expense.shares.map((s) =>
                        settled.has(s.id) ? { ...s, paid: true, paidAt: new Date().toISOString() } : s
                      ),
                    })),
                  rollbackOnError: true,
                  revalidate: false,
                }
              );
            } catch (err) {
              Alert.alert('Kunne ikke lagre', err instanceof Error ? err.message : 'Prøv igjen senere.');
            } finally {
              setSettlingId(null);
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
          <ThemedText type="smallBold">Balanse</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        showsVerticalScrollIndicator={false}>
        {error && !expenses ? (
          <ErrorState message="Klarte ikke å hente utgifter." onRetry={() => mutateExpenses()} />
        ) : isLoading ? (
          <RefreshSpinner active />
        ) : (
          <>
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary">
                Din balanse
              </ThemedText>
              <ThemedText
                style={[
                  styles.balanceAmount,
                  { color: balance < 0 ? theme.danger : balance > 0 ? theme.success : theme.text },
                ]}>
                {balance > 0 ? '+' : balance < 0 ? '−' : ''}
                {formatKr(Math.abs(balance))}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {balance < 0
                  ? 'Dette skylder du de andre til sammen.'
                  : balance > 0
                    ? 'Dette har du til gode fra de andre.'
                    : 'Alt er gjort opp i kollektivet.'}
              </ThemedText>
            </View>

            {settlements.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyEmoji}>🎉</ThemedText>
                <ThemedText type="smallBold">Ingen utestående</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Ingen skylder noen noe akkurat nå.
                </ThemedText>
              </View>
            ) : (
              settlements.map((settlement) => {
                const iOwe = settlement.net < 0;
                const busy = settlingId === settlement.personId;
                return (
                  <View
                    key={settlement.personId}
                    style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.cardHeader}>
                      <AvatarBadge
                        userId={settlement.personId}
                        name={settlement.name}
                        pictureUrl={settlement.pictureUrl}
                        shape="circle"
                        size={38}
                      />
                      <View style={styles.cardHeaderText}>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {settlement.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {iOwe ? 'Du skylder' : 'Skylder deg'}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.cardAmount,
                          { color: iOwe ? theme.danger : theme.success },
                        ]}>
                        {formatKr(Math.abs(settlement.net))}
                      </ThemedText>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    {/* The breakdown is the reason to open this screen: a total nobody can
                        account for is exactly what starts the argument it should prevent. */}
                    {settlement.lines.map((line, index) => (
                      <View key={`${line.expenseId}-${index}`} style={styles.line}>
                        <View style={styles.lineText}>
                          <ThemedText type="small" numberOfLines={1}>
                            {line.description}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {formatShortDate(new Date(line.date))} ·{' '}
                            {line.youOwe ? `${settlement.name} la ut` : 'du la ut'}
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="small"
                          themeColor={line.youOwe ? 'danger' : 'success'}
                          style={styles.lineAmount}>
                          {line.youOwe ? '−' : '+'}
                          {formatKr(line.amount)}
                        </ThemedText>
                      </View>
                    ))}

                    {iOwe && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleSettle(settlement)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.settleButton,
                          { backgroundColor: theme.brand },
                          busy && styles.disabled,
                          pressed && !busy && styles.pressed,
                        ]}>
                        {busy ? (
                          <ActivityIndicator color={theme.onBrand} />
                        ) : (
                          <ThemedText style={[styles.settleLabel, { color: theme.onBrand }]}>
                            Marker som betalt
                          </ThemedText>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </>
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
    gap: Spacing.four,
  },
  summary: {
    gap: Spacing.half,
  },
  balanceAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 38,
    lineHeight: 46,
  },
  card: {
    borderRadius: Radii.card,
    padding: Spacing.three + Spacing.half,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardAmount: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.three,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  lineText: {
    flex: 1,
    minWidth: 0,
  },
  lineAmount: {
    fontVariant: ['tabular-nums'],
  },
  settleButton: {
    height: Control.height,
    borderRadius: Control.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
  },
  settleLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  emptyText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
