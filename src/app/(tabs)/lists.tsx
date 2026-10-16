import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { api, errorMessage, keys, type ListKind, type ShoppingList } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { ListTile } from '@/components/magneten/lists/list-tile';
import { RoundButton } from '@/components/magneten/lists/round-button';
import { Sheet } from '@/components/magneten/lists/sheet';
import { Button, Field, Screen, SectionLabel, Title } from '@/components/magneten/ui';
import { Segmented } from '@/components/magneten/week/segmented';
import { FontFamily, MemberColors } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { LIST_TEMPLATES, type ListTemplate } from '@/lib/lists-items';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function ListsScreen() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { hid, membership } = useHousehold();
  const canManage = membership.role !== 'CHILD';
  const { data, error, isLoading, mutate } = useSWR(keys.lists(hid), () => api.lists.list(hid));

  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ListKind>('CHECKLIST');
  const [store, setStore] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // The shopping list(s) first, then checklists, each oldest first as the server sends them.
  const lists = [...(data ?? [])].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'SHOPPING' ? -1 : 1));

  const open = (l: ShoppingList) => router.push({ pathname: '/list/[id]', params: { id: l.id } });

  const create = async (input: { name: string; kind: ListKind; storeName?: string | null }, items: string[] = []) => {
    setBusy(input.name);
    try {
      const list = await api.lists.create(hid, input);
      // Sequential, so the template keeps its order.
      for (const text of items) await api.lists.addItem(hid, list.id, { text });
      Feel.smack();
      mutate();
      setSheet(false);
      setName('');
      setStore('');
      open(list);
    } catch (e) {
      Alert.alert(errorMessage(e));
      mutate();
    } finally {
      setBusy(null);
    }
  };

  const fromTemplate = (tpl: ListTemplate) => {
    const items = t(`lists.templates.${tpl}.items`, { returnObjects: true }) as unknown;
    create({ name: t(`lists.templates.${tpl}.name`), kind: 'CHECKLIST' }, Array.isArray(items) ? (items as string[]) : []);
  };

  const submitSheet = () => {
    const n = name.trim();
    if (!n) return Alert.alert(t('lists.create.nameRequired'));
    create({ name: n, kind, storeName: kind === 'SHOPPING' ? store.trim() || null : null });
  };

  return (
    <Screen tabs>
      <Title
        kicker={data ? t('lists.kicker', { count: data.length }) : undefined}
        title={t('lists.title')}
        right={
          canManage ? (
            <RoundButton
              icon="plus"
              variant="magne"
              label={t('lists.new')}
              onPress={() => {
                setKind(lists.some((l) => l.kind === 'SHOPPING') ? 'CHECKLIST' : 'SHOPPING');
                setSheet(true);
              }}
            />
          ) : undefined
        }
      />

      {isLoading && !data ? (
        <View style={styles.center}>
          <Magne pose="trekker" size={90} />
          <Text style={[styles.hand, { color: tokens.textSecondary }]}>{t('lists.loading')}</Text>
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Magne pose="lurer" size={80} />
          <Text style={[styles.body, { color: tokens.textSecondary }]}>{errorMessage(error)}</Text>
          <Button label={t('actions.retry')} variant="outline" onPress={() => mutate()} />
        </View>
      ) : lists.length === 0 ? (
        <View style={styles.center}>
          <Magne pose="sover" size={90} />
          <Text style={[styles.hand, { color: tokens.textSecondary }]}>{t('lists.empty')}</Text>
          {canManage ? (
            <Button
              label={t('lists.emptyCta')}
              loading={busy === t('lists.defaultShoppingName')}
              onPress={() => create({ name: t('lists.defaultShoppingName'), kind: 'SHOPPING' })}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.grid}>
          {pairs(lists).map((row, r) => (
            <View key={row[0].id} style={styles.gridRow}>
              {row.map((l, c) => (
                <ListTile
                  key={l.id}
                  list={l}
                  index={r * 2 + c}
                  pinColor={MemberColors[(r * 2 + c) % MemberColors.length]}
                  onPress={() => open(l)}
                />
              ))}
              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>
      )}

      {canManage ? (
        <View style={styles.templates}>
          <SectionLabel>{t('lists.templatesLabel')}</SectionLabel>
          <View style={styles.wrap}>
            {LIST_TEMPLATES.map((tpl) => {
              const label = t(`lists.templates.${tpl}.name`);
              return (
                <Pressable
                  key={tpl}
                  disabled={!!busy}
                  onPress={() => {
                    Feel.tick();
                    fromTemplate(tpl);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('lists.templateA11y', { name: label })}
                  accessibilityState={{ busy: busy === label, disabled: !!busy }}
                  style={({ pressed }) => [
                    styles.template,
                    {
                      backgroundColor: tokens.paper,
                      borderColor: tokens.textSecondary,
                      opacity: busy && busy !== label ? 0.5 : pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Text style={[styles.templateText, { color: tokens.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={t('lists.create.title')}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'CHECKLIST', label: t('lists.create.kindChecklist') },
            { value: 'SHOPPING', label: t('lists.create.kindShopping') },
          ]}
        />
        <Field
          label={t('lists.create.name')}
          value={name}
          onChangeText={setName}
          placeholder={kind === 'SHOPPING' ? t('lists.defaultShoppingName') : t('lists.create.namePlaceholder')}
          maxLength={80}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submitSheet}
        />
        {kind === 'SHOPPING' ? (
          <Field
            label={t('lists.create.store')}
            value={store}
            onChangeText={setStore}
            placeholder={t('lists.create.storePlaceholder')}
            maxLength={80}
          />
        ) : null}
        <Button label={t('lists.create.submit')} onPress={submitSheet} loading={!!busy} />
      </Sheet>
    </Screen>
  );
}

function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 36 },
  hand: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 20, lineHeight: 29, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  grid: { gap: 22, paddingTop: 12, paddingHorizontal: 2 },
  gridRow: { flexDirection: 'row', gap: 14 },
  templates: { gap: 10, paddingTop: 18 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  template: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  templateText: { fontFamily: FontFamily.bold, fontSize: 13 },
});
