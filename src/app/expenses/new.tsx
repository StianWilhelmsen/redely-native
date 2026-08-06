import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="eyebrow" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

function normalizeAmountInput(input: string): number | null {
  const normalized = input.replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export default function NewExpenseScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { data: members } = useSWR('members', api.members);
  const { mutate: mutateExpenses } = useSWR('expenses', api.expenses);
  const { mutate: globalMutate } = useSWRConfig();

  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paidByUserId, setPaidByUserId] = useState<number | null>(null);
  const [participantIds, setParticipantIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me && paidByUserId === null) setPaidByUserId(me.id);
  }, [me, paidByUserId]);

  useEffect(() => {
    if (members && participantIds.size === 0) {
      setParticipantIds(new Set(members.map((m) => m.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  const amount = normalizeAmountInput(amountInput);
  const perHead = useMemo(() => {
    if (!amount || participantIds.size === 0) return 0;
    return amount / participantIds.size;
  }, [amount, participantIds]);

  const toggleParticipant = (id: number) => {
    setParticipantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!amount || amount <= 0) {
      setError('Skriv inn et gyldig beløp.');
      return;
    }
    if (participantIds.size === 0) {
      setError('Velg minst én person å dele med.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createShoppingTripExpense(
        amount,
        description.trim() || 'Handletur',
        paidByUserId ?? undefined,
        Array.from(participantIds)
      );
      await Promise.all([mutateExpenses(), globalMutate('collective-stats')]);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two}>
          <ThemedText themeColor="textSecondary">Avbryt</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">Rapporter kjøp</ThemedText>
        <View style={styles.navBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <FieldLabel>Hva kjøpte du?</FieldLabel>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="F.eks. Ukens dagligvarer"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Beløp</FieldLabel>
          <View style={[styles.amountRow, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: theme.text }]}
            />
            <ThemedText themeColor="textSecondary">kr</ThemedText>
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel>Betalt av</FieldLabel>
          <View style={styles.assigneeRow}>
            {(members ?? []).map((member) => {
              const selected = member.id === paidByUserId;
              return (
                <Pressable key={member.id} onPress={() => setPaidByUserId(member.id)} style={styles.assigneeItem}>
                  <View style={[styles.assigneeRing, { borderColor: selected ? theme.brand : 'transparent' }]}>
                    <AvatarBadge
                      userId={member.id}
                      name={member.name}
                      pictureUrl={member.pictureUrl}
                      shape="circle"
                      size={44}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.assigneeName}>
                    {member.id === me?.id ? 'Deg' : member.name.split(' ')[0]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel>Del med</FieldLabel>
          <View style={styles.participantList}>
            {(members ?? []).map((member) => {
              const checked = participantIds.has(member.id);
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleParticipant(member.id)}
                  style={[styles.participantRow, { backgroundColor: theme.backgroundElement }]}>
                  <AvatarBadge userId={member.id} name={member.name} pictureUrl={member.pictureUrl} size={32} />
                  <ThemedText style={styles.participantName}>
                    {member.id === me?.id ? 'Deg' : member.name}
                  </ThemedText>
                  <View
                    style={[
                      styles.checkCircle,
                      { borderColor: checked ? theme.brand : theme.border },
                      checked && { backgroundColor: theme.brand },
                    ]}>
                    {checked && <Ionicons name="checkmark" size={14} color={theme.onBrand} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three, borderTopColor: theme.border }]}>
        <View style={[styles.summaryRow, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Hver person betaler
          </ThemedText>
          <ThemedText type="smallBold">{Math.round(perHead)} kr</ThemedText>
        </View>
        <PrimaryButton label="Del regningen" onPress={handleSubmit} loading={submitting} />
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBarSpacer: {
    width: 50,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    opacity: 0.8,
  },
  input: {
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
  },
  amountInput: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
  },
  assigneeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  assigneeItem: {
    alignItems: 'center',
    gap: Spacing.one,
    width: 60,
  },
  assigneeRing: {
    borderWidth: 2,
    borderRadius: 26,
    padding: 2,
  },
  assigneeName: {
    maxWidth: 60,
  },
  participantList: {
    gap: Spacing.two,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radii.input,
    padding: Spacing.two + 2,
  },
  participantName: {
    flex: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
});
