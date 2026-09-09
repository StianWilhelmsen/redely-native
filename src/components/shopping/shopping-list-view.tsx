import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, ZoomIn } from 'react-native-reanimated';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { rowEntrance, rowTransition } from '@/lib/animations';
import { api } from '@/lib/api';
import type { ShoppingItem } from '@/types/api';

export function ShoppingListView() {
  const theme = useTheme();
  const { data: items, error, mutate: mutateItems, isLoading } = useSWR('shopping-items', api.shoppingItems);

  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

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
  const purchasedItems = allItems.filter((i) => i.purchased);

  return (
    <>
      {/* At the top, not floating above the tab bar: adding is what people open this
          screen to do, and a field you can see is faster than one you have to reach for. */}
      <View style={styles.addRow}>
        <TextInput
          value={newItemName}
          onChangeText={setNewItemName}
          onSubmitEditing={handleAdd}
          placeholder="Legg til vare…"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          style={[styles.addInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Legg til vare"
          onPress={handleAdd}
          disabled={adding || !newItemName.trim()}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.brand },
            (adding || !newItemName.trim()) && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {adding ? (
            <ActivityIndicator size="small" color={theme.onBrand} />
          ) : (
            <Ionicons name="add" size={24} color={theme.onBrand} />
          )}
        </Pressable>
      </View>

      <Section
        title="Mangler"
        variant="eyebrow"
        meta={openItems.length > 0 ? `${openItems.length} varer` : undefined}>
        {error && !items ? (
          <ErrorState message="Klarte ikke å hente handlelisten." onRetry={() => mutateItems()} />
        ) : isLoading ? (
          <RefreshSpinner active />
        ) : openItems.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Listen er tom — legg til det som mangler.
          </ThemedText>
        ) : (
          <View>
            {openItems.map((item, index) => (
              <ItemRow
                key={item.id}
                index={index}
                item={item}
                busy={busyId === item.id}
                onToggle={() => handleTogglePurchased(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </View>
        )}
      </Section>

      {purchasedItems.length > 0 && (
        <Section
          title="Kjøpt denne uka"
          variant="eyebrow"
          meta={
            <Pressable disabled={clearing} onPress={handleClearPurchased} hitSlop={Spacing.two}>
              {clearing ? (
                <ActivityIndicator size="small" color={theme.brand} />
              ) : (
                <ThemedText type="smallBold" themeColor="brand">
                  Tøm
                </ThemedText>
              )}
            </Pressable>
          }>
          <View>
            {purchasedItems.map((item, index) => (
              <ItemRow
                key={item.id}
                index={index}
                item={item}
                busy={busyId === item.id}
                onToggle={() => handleTogglePurchased(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </View>
        </Section>
      )}
    </>
  );
}

function ItemRow({
  item,
  index,
  busy,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  index: number;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();

  return (
    // layout, not just entering: ticking an item moves it from one section to the other,
    // and gliding there keeps it obvious which item just moved.
    <Animated.View entering={rowEntrance(index)} layout={rowTransition}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.purchased }}
        accessibilityLabel={item.name}
        accessibilityHint="Hold inne for å fjerne varen"
        disabled={busy}
        onPress={onToggle}
        onLongPress={onDelete}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View
          style={[
            styles.checkbox,
            item.purchased
              ? { backgroundColor: theme.brand, borderColor: theme.brand }
              : { borderColor: theme.border },
          ]}>
          {item.purchased && (
            <Animated.View entering={ZoomIn.duration(180).easing(Easing.out(Easing.quad))}>
              <Ionicons name="checkmark" size={15} color={theme.onBrand} />
            </Animated.View>
          )}
        </View>

        <ThemedText
          type="smallBold"
          numberOfLines={1}
          themeColor={item.purchased ? 'textSecondary' : 'text'}
          style={[styles.name, item.purchased && styles.struck]}>
          {item.name}
        </ThemedText>

        {item.addedBy && (
          <AvatarBadge
            userId={item.addedBy.id}
            name={item.addedBy.name}
            pictureUrl={item.addedBy.pictureUrl}
            shape="circle"
            size={24}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.half,
  },
  addInput: {
    flex: 1,
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.three + Spacing.half,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  addButton: {
    width: Control.height,
    height: Control.height,
    borderRadius: Control.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  empty: {
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.5,
  },
});
