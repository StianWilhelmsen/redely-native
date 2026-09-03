import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { buildSettlements, formatKr, netBalance, type Settlement } from '@/lib/settlements';
import type { Expense } from '@/types/api';

export function BillsView({ onPaid }: { onPaid: (message: string) => void }) {
  const theme = useTheme();
  const { data: me } = useMe();
  const { data: expenses, error, mutate: mutateExpenses, isLoading } = useSWR('expenses', api.expenses);
  const dingPlayer = useAudioPlayer(require('@/assets/ding-sfx.mp3'));

  const allExpenses = expenses ?? [];
  const settlements = buildSettlements(allExpenses, me?.id);
  const balance = netBalance(settlements);

  const handleSettle = async (settlement: Settlement) => {
    if (settlement.shareIds.length === 0) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dingPlayer.seekTo(0);
    dingPlayer.play();
    onPaid('Betalt! 🎉');

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
    }
  };

  const monthLabel = new Date().toLocaleDateString('nb-NO', { month: 'long' });

  if (error && !expenses) {
    return <ErrorState message="Klarte ikke å hente utgifter." onRetry={() => mutateExpenses()} />;
  }
  if (isLoading) {
    return <RefreshSpinner active />;
  }

  return (
    <>
      {/* The number is the summary; the chevron is for when it needs explaining. What a
          balance is actually made of lives one screen deeper. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Din balanse ${formatKr(Math.abs(balance))}. Se hvem du skylder.`}
        onPress={() => router.push('/balance')}
        style={({ pressed }) => [styles.balance, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          Din balanse
        </ThemedText>
        <View style={styles.balanceRow}>
          <ThemedText
            style={[
              styles.balanceAmount,
              { color: balance < 0 ? theme.danger : balance > 0 ? theme.success : theme.text },
            ]}>
            {balance > 0 ? '+' : balance < 0 ? '−' : ''}
            {formatKr(Math.abs(balance))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.balanceCaption}>
            {balance < 0 ? 'du skylder' : balance > 0 ? 'du har til gode' : 'alt er gjort opp'}
          </ThemedText>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </Pressable>

      {settlements.length > 0 && (
        <Section title="Gjør opp" variant="eyebrow">
          <View>
            {settlements.map((settlement) => {
              const iOwe = settlement.net < 0;
              return (
                <View key={settlement.personId} style={styles.settlementRow}>
                  <AvatarBadge
                    userId={settlement.personId}
                    name={settlement.name}
                    pictureUrl={settlement.pictureUrl}
                    shape="circle"
                    size={34}
                  />
                  <View style={styles.settlementText}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {iOwe ? `Du skylder ${settlement.name}` : `${settlement.name} skylder deg`}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {Array.from(new Set(settlement.lines.map((line) => line.description))).join(' + ')}
                    </ThemedText>
                  </View>
                  <View style={styles.settlementAmount}>
                    <ThemedText type="smallBold">{formatKr(Math.abs(settlement.net))}</ThemedText>
                    {iOwe && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Marker som betalt til ${settlement.name}`}
                        onPress={() => handleSettle(settlement)}
                        hitSlop={Spacing.two}>
                        <ThemedText type="smallBold" themeColor="brand">
                          Betal
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Section>
      )}

      <Section title="Utgifter" variant="eyebrow" meta={monthLabel}>
        {allExpenses.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Ingen utgifter registrert ennå.
          </ThemedText>
        ) : (
          <View>
            {allExpenses.slice(0, 20).map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} meId={me?.id} />
            ))}
          </View>
        )}
      </Section>
    </>
  );
}

function ExpenseRow({ expense, meId }: { expense: Expense; meId: number | undefined }) {
  // Shares only exist for the people who owe, so the payer has to be counted back in.
  const splitCount = expense.shares.length + 1;
  const payer = expense.paidBy?.id === meId ? 'Du betalte' : `${expense.paidBy?.name ?? 'Ukjent'} betalte`;

  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {expense.description || 'Handletur'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {payer} · delt på {splitCount}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{formatKr(expense.amount)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  balance: {
    gap: Spacing.one,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  balanceAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 42,
  },
  balanceCaption: {
    flex: 1,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  settlementText: {
    flex: 1,
    minWidth: 0,
  },
  settlementAmount: {
    alignItems: 'flex-end',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  expenseText: {
    flex: 1,
    minWidth: 0,
  },
  empty: {
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
