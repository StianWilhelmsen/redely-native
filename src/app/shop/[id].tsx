import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  SlideOutRight,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';
import useSWR from 'swr';

import { api, errorMessage, keys, type ListItem } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { ProgressRing } from '@/components/magneten/lists/progress-ring';
import { RoundButton } from '@/components/magneten/lists/round-button';
import { Button, Screen, SectionLabel } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { useListActions } from '@/lib/lists-actions';
import { groupByCategory } from '@/lib/lists-items';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

/** Butikkmodus: big rows by aisle, a ring that fills, a basket that fills. */
export default function ShopScreen() {
  const { t } = useTranslation();
  const { tokens, scheme } = usePalette();
  const reduceMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hid, membership } = useHousehold();
  const { data, error } = useSWR(keys.list(hid, id), () => api.lists.get(hid, id));
  const actions = useListActions(hid, id, membership.memberId);
  const [finishing, setFinishing] = useState(false);

  if (!data) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        {error ? (
          <>
            <Magne pose="lurer" size={90} />
            <Text style={[styles.body, { color: tokens.textSecondary }]}>{errorMessage(error)}</Text>
            <Button label={t('actions.back')} variant="outline" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Magne pose="trekker" size={90} />
            <ActivityIndicator color={tokens.textSecondary} />
          </>
        )}
      </Screen>
    );
  }

  const items = data.items;
  const basket = items.filter((i) => i.done);
  const left = items.length - basket.length;
  const groups = groupByCategory(items);
  const allDone = items.length > 0 && left === 0;

  const finish = async () => {
    setFinishing(true);
    try {
      await actions.clearDone();
      actions.dropDone();
      Feel.cheer();
      router.back();
    } catch (e) {
      setFinishing(false);
      Alert.alert(errorMessage(e));
    }
  };

  const pick = (item: ListItem) => {
    Feel.tick();
    actions.toggle(item, true);
    if (left === 1) setTimeout(Feel.cheer, 350);
  };

  const layout = reduceMotion ? undefined : LinearTransition.duration(320);

  return (
    <Screen scroll={false} contentStyle={{ flex: 1 }}>
      <View style={styles.header}>
        <RoundButton icon="back" label={t('actions.back')} onPress={() => router.back()} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: tokens.textSecondary }]} numberOfLines={1}>
            {data.list.storeName ?? data.list.name}
          </Text>
          <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header" accessibilityLiveRegion="polite">
            {items.length === 0 ? data.list.name : left === 0 ? t('lists.shop.allFound') : t('lists.shop.left', { count: left })}
          </Text>
        </View>
        <ProgressRing
          done={basket.length}
          total={items.length}
          label={t('lists.shop.progress', { done: basket.length, total: items.length })}
        />
      </View>

      {items.length === 0 ? (
        <View style={styles.center}>
          <Magne pose="sover" size={100} />
          <Text style={[styles.hand, { color: tokens.textSecondary }]}>{t('lists.shop.empty')}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.groups} showsVerticalScrollIndicator={false}>
          {groups.map((g) => {
            const open = g.items.filter((i) => !i.done);
            return (
              <Animated.View
                key={g.category ?? '__other'}
                layout={layout}
                style={[styles.group, { backgroundColor: tokens.paper, opacity: open.length ? 1 : 0.35 }]}>
                <Text style={[styles.groupName, { color: tokens.textSecondary }]}>
                  {(g.category ?? t('lists.shop.other')).toUpperCase()}
                </Text>
                {open.map((item) => (
                  <Animated.View
                    key={actions.rowKey(item.id)}
                    layout={layout}
                    entering={reduceMotion ? undefined : FadeIn.duration(200)}
                    exiting={reduceMotion ? undefined : SlideOutRight.duration(320)}>
                    <Pressable
                      onPress={() => pick(item)}
                      accessibilityRole="button"
                      accessibilityLabel={t('lists.shop.put', { item: item.text })}
                      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
                      <View style={[styles.box, { borderColor: tokens.text }]} />
                      <Text style={[styles.rowText, { color: tokens.text }]}>{item.text}</Text>
                      {item.quantity ? (
                        <Text style={[styles.qty, { color: tokens.textSecondary }]}>{item.quantity}</Text>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.bottom}>
        {allDone ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(450)}
            style={[styles.banner, { backgroundColor: tokens.paper }]}>
            <Magne pose="jubler" size={70} />
            <View style={styles.bannerBody}>
              <Text style={[styles.bannerTitle, { color: tokens.text }]}>{t('lists.shop.allInBasket')}</Text>
              <Button label={t('lists.shop.finish')} onPress={finish} loading={finishing} style={styles.bannerBtn} />
            </View>
          </Animated.View>
        ) : null}
        {items.length ? (
          <>
            <SectionLabel>{t('lists.shop.basket')}</SectionLabel>
            <ScrollView style={styles.basketScroll} contentContainerStyle={styles.basket}>
              {basket.length === 0 ? (
                <Text style={[styles.body, { color: tokens.textSecondary, textAlign: 'left' }]}>
                  {t('lists.shop.basketEmpty')}
                </Text>
              ) : null}
              {basket.map((item) => (
                <Animated.View
                  key={actions.rowKey(item.id)}
                  entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
                  layout={layout}>
                  <Pressable
                    onPress={() => {
                      Feel.tick();
                      actions.toggle(item, false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('lists.shop.takeOut', { item: item.text })}
                    hitSlop={{ top: 6, bottom: 6 }}
                    style={[styles.chip, { backgroundColor: tokens.stamp }]}>
                    <Text style={[styles.chipText, { color: scheme === 'dark' ? tokens.ink : '#FFFFFF' }]}>{item.text}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
  hand: { fontFamily: FontFamily.hand, fontSize: 20, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kicker: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  title: { fontFamily: FontFamily.hand, fontSize: 28, lineHeight: 32 },
  groups: { gap: 10, paddingBottom: 12 },
  group: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  groupName: { fontFamily: FontFamily.extraBold, fontSize: 11.5, letterSpacing: 0.7, paddingTop: 6, paddingBottom: 2 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14 },
  box: { width: 30, height: 30, borderRadius: 9, borderWidth: 2.5 },
  rowText: { flex: 1, fontFamily: FontFamily.bold, fontSize: 18 },
  qty: { fontFamily: FontFamily.regular, fontSize: 12.5 },
  bottom: { gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderRadius: 18, paddingTop: 4, paddingRight: 16, paddingBottom: 12, paddingLeft: 6 },
  bannerBody: { flex: 1, gap: 6, paddingBottom: 4 },
  bannerTitle: { fontFamily: FontFamily.hand, fontSize: 21, lineHeight: 24 },
  bannerBtn: { alignSelf: 'flex-start', paddingVertical: 11 },
  basketScroll: { maxHeight: 110, flexGrow: 0 },
  basket: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 30 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: FontFamily.bold, fontSize: 13 },
});
