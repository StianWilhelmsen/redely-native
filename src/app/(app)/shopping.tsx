import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { CelebrationOverlay } from '@/components/celebration/celebration-overlay';
import { useCelebration } from '@/components/celebration/use-celebration';
import { ErrorState } from '@/components/error-state';
import { PillSegmentedControl } from '@/components/pill-segmented-control';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadPayments } from '@/hooks/use-unread';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/date-utils';
import type { Expense, ShoppingItem } from '@/types/api';

type Tab = 'handleliste' | 'regninger';

function formatKr(amount: number): string {
  return `${Math.round(amount)} kr`;
}

export default function SharedScreen() {
  const [tab, setTab] = useState<Tab>('handleliste');
  const { message, burstKey, celebrate, dismiss } = useCelebration();
  const { mutate: globalMutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const { markRead: markPaymentsRead } = useUnreadPayments();

  useEffect(() => {
    if (tab === 'regninger') markPaymentsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([globalMutate('shopping-items'), globalMutate('expenses')]);
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <ScreenScroll
        eyebrow="Felles"
        title={tab === 'handleliste' ? 'Handleliste' : 'Regninger'}
        headerExtra={
          <PillSegmentedControl
            options={[
              { key: 'handleliste', label: 'Handleliste' },
              { key: 'regninger', label: 'Regninger' },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}>
        {tab === 'handleliste' ? <ShoppingListView /> : <ExpensesView onPaid={celebrate} />}
      </ScreenScroll>

      {tab === 'handleliste' && <ShoppingAddBar />}
      {tab === 'regninger' && <ExpenseFab />}

      <CelebrationOverlay message={message} burstKey={burstKey} onDismiss={dismiss} />
    </View>
  );
}

function ExpenseFab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Rapporter kjøp"
      onPress={() => router.push('/expenses/new')}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: theme.brand,
          bottom: Math.max(insets.bottom, Spacing.three) + BottomTabInset - Spacing.two - 60,
        },
        pressed && styles.fabPressed,
      ]}>
      <Ionicons name="add" size={30} color={theme.onBrand} />
    </Pressable>
  );
}

function ShoppingAddBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { mutate: mutateItems } = useSWR('shopping-items', api.shoppingItems);

  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);

  // iOS: the bar is absolutely positioned, so it must ride up above the keyboard
  // manually. Android resizes the window (adjustResize) which moves it already.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener('keyboardWillShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAdd = async () => {
    const name = newItemName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      await api.createShoppingItem(name);
      setNewItemName('');
      await mutateItems();
    } catch (err) {
      Alert.alert('Kunne ikke legge til', err instanceof Error ? err.message : 'Prøv igjen senere.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <View
      style={[
        styles.addBar,
        {
          backgroundColor: theme.backgroundElement,
          bottom:
            keyboardHeight > 0
              ? keyboardHeight + Spacing.two
              : Math.max(insets.bottom, Spacing.three) + BottomTabInset - Spacing.two - 60,
        },
      ]}>
      <TextInput
        value={newItemName}
        onChangeText={setNewItemName}
        onSubmitEditing={handleAdd}
        placeholder="Legg til vare…"
        placeholderTextColor={theme.textSecondary}
        style={[styles.addInput, { color: theme.text }]}
        returnKeyType="done"
      />
      <Pressable onPress={handleAdd} disabled={adding} style={[styles.addButton, { backgroundColor: theme.brand }]}>
        {adding ? (
          <ActivityIndicator size="small" color={theme.onBrand} />
        ) : (
          <Ionicons name="add" size={22} color={theme.onBrand} />
        )}
      </Pressable>
    </View>
  );
}

function ShoppingListView() {
  const theme = useTheme();
  const { data: items, error, mutate: mutateItems, isLoading } = useSWR('shopping-items', api.shoppingItems);

  const [busyId, setBusyId] = useState<number | null>(null);

  const handleTogglePurchased = async (item: ShoppingItem) => {
    setBusyId(item.id);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await mutateItems(
        async (current) => {
          const updated = await api.setShoppingItemPurchased(item.id, !item.purchased);
          return (current ?? []).map((i) => (i.id === item.id ? updated : i));
        },
        {
          optimisticData: (current) =>
            (current ?? []).map((i) => (i.id === item.id ? { ...i, purchased: !item.purchased } : i)),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch (err) {
      Alert.alert('Kunne ikke lagre', err instanceof Error ? err.message : 'Prøv igjen senere.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: ShoppingItem) => {
    setBusyId(item.id);
    try {
      await mutateItems(
        async (current) => {
          await api.deleteShoppingItem(item.id);
          return (current ?? []).filter((i) => i.id !== item.id);
        },
        {
          optimisticData: (current) => (current ?? []).filter((i) => i.id !== item.id),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch (err) {
      Alert.alert('Kunne ikke slette', err instanceof Error ? err.message : 'Prøv igjen senere.');
    } finally {
      setBusyId(null);
    }
  };

  const [clearing, setClearing] = useState(false);

  const handleClearPurchased = () => {
    Alert.alert('Tøm kjøpt-listen', 'Fjerner alle kjøpte varer fra handlelisten.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Tøm',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await mutateItems(
              async (current) => {
                await api.clearPurchasedShoppingItems();
                return (current ?? []).filter((i) => !i.purchased);
              },
              {
                optimisticData: (current) => (current ?? []).filter((i) => !i.purchased),
                rollbackOnError: true,
                revalidate: false,
              }
            );
          } catch (err) {
            Alert.alert('Kunne ikke tømme', err instanceof Error ? err.message : 'Prøv igjen senere.');
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  const allItems = items ?? [];
  const openItems = allItems.filter((i) => !i.purchased);
  const purchasedItems = allItems.filter((i) => i.purchased).slice(0, 8);

  return (
    <>
      <View style={{ gap: Spacing.five }}>
        <Section title="På listen" meta={openItems.length > 0 ? `${openItems.length}` : undefined}>
          {error && !items ? (
            <ErrorState message="Klarte ikke å hente handlelisten." onRetry={() => mutateItems()} />
          ) : isLoading ? (
            <RefreshSpinner active />
          ) : openItems.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyEmoji}>🛒</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Listen er tom — legg til det som mangler.
              </ThemedText>
            </View>
          ) : (
            <View>
              {openItems.map((item, index) => (
                <Fragment key={item.id}>
                  {index > 0 && <Separator />}
                  <View style={styles.row}>
                    <Pressable
                      disabled={busyId === item.id}
                      onPress={() => handleTogglePurchased(item)}
                      style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
                      <View style={[styles.checkbox, { borderColor: theme.border }]} />
                      <ThemedText>{item.name}</ThemedText>
                    </Pressable>
                    {item.addedBy && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.addedBy.name.split(' ')[0]}
                      </ThemedText>
                    )}
                    <Pressable
                      disabled={busyId === item.id}
                      onPress={() => handleDelete(item)}
                      hitSlop={Spacing.one}
                      style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </Pressable>
                  </View>
                </Fragment>
              ))}
            </View>
          )}
        </Section>

        {purchasedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="heading">Kjøpt</ThemedText>
              <Pressable disabled={clearing} onPress={handleClearPurchased} hitSlop={Spacing.two}>
                {clearing ? (
                  <ActivityIndicator size="small" color={theme.danger} />
                ) : (
                  <ThemedText type="small" themeColor="danger">
                    Tøm
                  </ThemedText>
                )}
              </Pressable>
            </View>
            <View>
              {purchasedItems.map((item, index) => (
                <Fragment key={item.id}>
                  {index > 0 && <Separator />}
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => handleTogglePurchased(item)}
                    style={({ pressed }) => [styles.rowMain, styles.purchasedRow, pressed && styles.pressed]}>
                    <View
                      style={[
                        styles.checkbox,
                        styles.checkboxChecked,
                        { backgroundColor: theme.brand, borderColor: theme.brand },
                      ]}>
                      <Ionicons name="checkmark" size={14} color={theme.onBrand} />
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.strikethrough}>
                      {item.name}
                    </ThemedText>
                  </Pressable>
                </Fragment>
              ))}
            </View>
          </View>
        )}
      </View>
      <View style={styles.addBarSpacer} />
    </>
  );
}

function ExpensesView({ onPaid }: { onPaid: (message: string) => void }) {
  const theme = useTheme();
  const { data: me } = useMe();
  const { data: expenses, error, mutate: mutateExpenses, isLoading } = useSWR('expenses', api.expenses);
  const dingPlayer = useAudioPlayer(require('@/assets/ding-sfx.mp3'));

  const handleMarkPaid = async (shareId: number) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dingPlayer.seekTo(0);
    dingPlayer.play();
    onPaid('Betalt! 🎉');

    try {
      await mutateExpenses(
        async (current) => {
          const updatedShare = await api.markSharePaid(shareId);
          return (current ?? []).map((expense) => ({
            ...expense,
            shares: expense.shares.map((s) => (s.id === shareId ? updatedShare : s)),
          }));
        },
        {
          optimisticData: (current) =>
            (current ?? []).map((expense) => ({
              ...expense,
              shares: expense.shares.map((s) =>
                s.id === shareId ? { ...s, paid: true, paidAt: new Date().toISOString() } : s
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

  // Matches the backend's rule: the payer (or an admin) can delete, but only while
  // nobody has settled their share - after that, deleting would erase real money moved.
  const canDelete = (expense: Expense) =>
    (expense.paidBy?.id === me?.id || me?.admin) && expense.shares.every((s) => !s.paid);

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      'Slett utgift',
      `Vil du slette «${expense.description || 'Handletur'}» på ${formatKr(expense.amount)}? De andre skylder deg ikke lenger noe for denne.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: async () => {
            try {
              await mutateExpenses(
                async (current) => {
                  await api.deleteExpense(expense.id);
                  return (current ?? []).filter((e) => e.id !== expense.id);
                },
                {
                  optimisticData: (current) => (current ?? []).filter((e) => e.id !== expense.id),
                  rollbackOnError: true,
                  revalidate: false,
                }
              );
            } catch (err) {
              Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Prøv igjen senere.');
            }
          },
        },
      ]
    );
  };

  const allExpenses = expenses ?? [];

  const myUnpaid = allExpenses.flatMap((expense) =>
    expense.shares
      .filter((share) => share.user.id === me?.id && !share.paid)
      .map((share) => ({ share, paidBy: expense.paidBy }))
  );

  const owedByPerson = new Map<number, { name: string; pictureUrl: string | null; total: number }>();
  for (const { share, paidBy } of myUnpaid) {
    if (!paidBy) continue;
    const entry = owedByPerson.get(paidBy.id) ?? { name: paidBy.name, pictureUrl: paidBy.pictureUrl, total: 0 };
    entry.total += share.amountOwed;
    owedByPerson.set(paidBy.id, entry);
  }
  const totalOwed = myUnpaid.reduce((sum, u) => sum + u.share.amountOwed, 0);
  const recentExpenses = allExpenses.slice(0, 10);

  return (
    <View style={{ gap: Spacing.five }}>
      <View style={[styles.balanceCard, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="eyebrow">Du skylder totalt</ThemedText>
        <ThemedText type="display" style={styles.balanceAmount}>
          {formatKr(totalOwed)}
        </ThemedText>
        {Array.from(owedByPerson.entries()).map(([userId, entry]) => (
          <View key={userId} style={styles.balanceRow}>
            <AvatarBadge userId={userId} name={entry.name} pictureUrl={entry.pictureUrl} size={28} />
            <ThemedText type="small" style={styles.balanceName}>
              Til {entry.name.split(' ')[0]}
            </ThemedText>
            <ThemedText type="smallBold">{formatKr(entry.total)}</ThemedText>
          </View>
        ))}
      </View>

      <Section title="Nylige kjøp">
        {error && !expenses ? (
          <ErrorState message="Klarte ikke å hente utgifter." onRetry={() => mutateExpenses()} />
        ) : isLoading ? (
          <RefreshSpinner active />
        ) : recentExpenses.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Ingen utgifter registrert ennå.
          </ThemedText>
        ) : (
          <View>
            {recentExpenses.map((expense, index) => {
              const myShare = expense.shares.find((s) => s.user.id === me?.id);
              return (
                <Fragment key={expense.id}>
                  {index > 0 && <Separator />}
                  <View style={styles.expenseRow}>
                    {expense.paidBy && (
                      <AvatarBadge userId={expense.paidBy.id} name={expense.paidBy.name} pictureUrl={expense.paidBy.pictureUrl} size={36} />
                    )}
                    <View style={styles.expenseInfo}>
                      <ThemedText type="small">{expense.description || 'Handletur'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Betalt av {expense.paidBy?.name.split(' ')[0] ?? 'ukjent'} · {formatShortDate(new Date(expense.date))}
                      </ThemedText>
                    </View>
                    <View style={styles.expenseMeta}>
                      <ThemedText type="smallBold">{formatKr(expense.amount)}</ThemedText>
                      {myShare && !myShare.paid ? (
                        <PrimaryButton
                          label="Betalt"
                          variant="secondary"
                          onPress={() => handleMarkPaid(myShare.id)}
                        />
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          {myShare ? `Din del: ${formatKr(myShare.amountOwed)}` : '—'}
                        </ThemedText>
                      )}
                    </View>
                    {canDelete(expense) && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Slett utgift"
                        onPress={() => handleDelete(expense)}
                        hitSlop={Spacing.one}
                        style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </Pressable>
                    )}
                  </View>
                </Fragment>
              );
            })}
          </View>
        )}
      </Section>
      <View style={styles.addBarSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  purchasedRow: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.5,
  },
  deleteButton: {
    padding: Spacing.one,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
  },
  checkboxChecked: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.five,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  addBarSpacer: {
    height: 64,
  },
  addBar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radii.pill,
    padding: Spacing.one + 2,
    paddingLeft: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addInput: {
    flex: 1,
    fontSize: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  balanceAmount: {
    fontSize: 40,
    lineHeight: 48,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  balanceName: {
    flex: 1,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  expenseInfo: {
    flex: 1,
    gap: 2,
  },
  expenseMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 6px 20px rgba(0,0,0,0.2)' } : null),
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
