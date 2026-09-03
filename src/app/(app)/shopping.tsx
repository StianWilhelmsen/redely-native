import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSWRConfig } from 'swr';

import { CelebrationOverlay } from '@/components/celebration/celebration-overlay';
import { useCelebration } from '@/components/celebration/use-celebration';
import { PillSegmentedControl } from '@/components/pill-segmented-control';
import { ScreenScroll } from '@/components/screen-scroll';
import { BillsView } from '@/components/shopping/bills-view';
import { ShoppingListView } from '@/components/shopping/shopping-list-view';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Control, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadPayments } from '@/hooks/use-unread';

type Tab = 'handleliste' | 'regninger';

export default function SharedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  const showingBills = tab === 'regninger';

  return (
    <View style={styles.root}>
      <ScreenScroll
        eyebrow="Felles"
        title="Handle"
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
        onRefresh={handleRefresh}
        style={showingBills ? styles.billsPadding : undefined}>
        {showingBills ? <BillsView onPaid={celebrate} /> : <ShoppingListView />}
      </ScreenScroll>

      {/* Pinned rather than at the end of the list: adding an expense is the reason to
          open this tab, and it should not depend on how far the month has scrolled. */}
      {showingBills && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/expenses/new')}
          style={({ pressed }) => [
            styles.addExpense,
            {
              backgroundColor: theme.brand,
              bottom: Math.max(insets.bottom, Spacing.three) + BottomTabInset - Spacing.three,
            },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={[styles.addExpenseLabel, { color: theme.onBrand }]}>
            Legg til utgift
          </ThemedText>
        </Pressable>
      )}

      <CelebrationOverlay message={message} burstKey={burstKey} onDismiss={dismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  /** Clears the pinned button so the last expense is never hidden behind it. */
  billsPadding: {
    paddingBottom: BottomTabInset + Control.height + Spacing.six,
  },
  addExpense: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    height: Control.height,
    borderRadius: Control.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExpenseLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
});
