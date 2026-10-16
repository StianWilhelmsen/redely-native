import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { api, errorMessage, keys } from '@/api';
import { PaperNote, TopBar } from '@/components/magneten/family/parts';
import { Magne } from '@/components/magneten/magne';
import { Button, Screen } from '@/components/magneten/ui';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { formatLongDate } from '@/lib/family-dates';
import {
  getPlussPrices,
  PLUSS_PRODUCTS,
  PurchaseCancelledError,
  PurchasesNotConfiguredError,
  purchasePlan,
  restorePurchases,
  type PlussPlan,
} from '@/lib/purchases';
import { useHousehold, useMeState } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

const FREE_ITEMS = ['door', 'week', 'shopping', 'lists', 'ukeplan', 'family'] as const;
const PLUSS_ITEMS = ['ukeplan', 'dinner', 'homes', 'allowance', 'sync', 'history'] as const;

export default function PlussScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const { hid, isAdult, members } = useHousehold();
  const { mutateMe } = useMeState();
  const { mutate } = useSWRConfig();
  const { data: sub, mutate: mutateSub } = useSWR(keys.subscription(hid), () => api.subscription.get(hid));
  const [plan, setPlan] = useState<PlussPlan>('yearly');
  const [prices, setPrices] = useState<Partial<Record<PlussPlan, string>> | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    getPlussPrices().then(setPrices);
  }, []);

  const refresh = () => {
    mutateSub();
    mutate(keys.household(hid));
    mutateMe();
  };

  const notAvailable = () => Alert.alert(t('family.pluss.unavailableTitle'), t('family.pluss.unavailableBody'));

  const buy = async () => {
    setBusy('buy');
    try {
      await purchasePlan(PLUSS_PRODUCTS[plan]);
      await api.subscription.purchaseCompleted(hid).catch(() => {});
      Feel.cheer();
      refresh();
      // The store's webhook grants Pluss; it can land a moment after the purchase.
      setTimeout(refresh, 4000);
      Alert.alert(t('family.pluss.thanksTitle'), t('family.pluss.thanksBody'));
    } catch (e) {
      if (e instanceof PurchaseCancelledError) return;
      if (e instanceof PurchasesNotConfiguredError) notAvailable();
      else Alert.alert(t('family.pluss.failed'), errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await restorePurchases();
      refresh();
      setTimeout(refresh, 4000);
      Alert.alert(t('family.pluss.restoredTitle'), t('family.pluss.restoredBody'));
    } catch (e) {
      if (e instanceof PurchasesNotConfiguredError) notAvailable();
      else Alert.alert(t('family.pluss.failed'), errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const adults = members.filter((m) => m.role === 'ADULT' && m.hasLogin).map((m) => m.displayName);
  const yearly = prices?.yearly ? t('family.pluss.perYear', { price: prices.yearly }) : t('family.pluss.yearlyFallback');
  const monthly = prices?.monthly
    ? t('family.pluss.perMonth', { price: prices.monthly })
    : t('family.pluss.monthlyFallback');

  return (
    <Screen>
      <TopBar icon="close" />

      <View style={styles.hero}>
        <Magne pose={sub?.isPluss ? 'jubler' : 'trekker'} size={96} />
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
          {t('family.pluss.title')}
        </Text>
        <Text style={[styles.lead, { color: tokens.textSecondary }]}>{t('family.pluss.lead')}</Text>
      </View>

      {sub?.isPluss ? (
        <PaperNote paper={tokens.paperYellow} magnet={tokens.magne} tilt={1} outline={tokens.magne} centered>
          <Text style={[styles.noteTitle, { color: tokens.paperInk }]}>{t('family.pluss.onTitle')}</Text>
          {sub.payerName ? (
            <Text style={[styles.body, { color: tokens.paperInk }]}>
              {sub.isPayer ? t('family.pluss.youPay') : t('family.pluss.paidBy', { name: sub.payerName })}
            </Text>
          ) : null}
          {sub.currentPeriodEnd ? (
            <Text style={[styles.body, { color: tokens.paperInk }]}>
              {sub.status === 'CANCELED'
                ? t('family.pluss.endsOn', { date: formatLongDate(sub.currentPeriodEnd, i18n.language) })
                : t('family.pluss.renewsOn', { date: formatLongDate(sub.currentPeriodEnd, i18n.language) })}
            </Text>
          ) : null}
          <Text style={[styles.body, { color: tokens.paperInk }]}>{t('family.pluss.onBody')}</Text>
          {sub.isPayer ? (
            <Text style={[styles.small, { color: tokens.paperInk }]}>{t('family.pluss.manage')}</Text>
          ) : null}
        </PaperNote>
      ) : (
        <>
          <View style={styles.notes}>
            <PaperNote paper={tokens.paper} magnet="#A3AFB4" tilt={-1.2} centered style={styles.half}>
              <Text style={[styles.noteTitle, { color: tokens.paperInk }]}>{t('family.pluss.free')}</Text>
              {FREE_ITEMS.map((k) => (
                <Text key={k} style={[styles.item, { color: tokens.paperInk }]}>
                  {t(`family.pluss.freeItems.${k}`)}
                </Text>
              ))}
            </PaperNote>
            <PaperNote
              paper={tokens.paperYellow}
              magnet={tokens.magne}
              tilt={1.2}
              centered
              outline={tokens.magne}
              style={styles.half}>
              <Text style={[styles.noteTitle, { color: tokens.paperInk }]}>{t('family.pluss.pluss')}</Text>
              {PLUSS_ITEMS.map((k) => (
                <Text key={k} style={[styles.item, { color: tokens.paperInk }]}>
                  {t(`family.pluss.plussItems.${k}`)}
                </Text>
              ))}
            </PaperNote>
          </View>

          <View style={styles.plans} accessibilityRole="radiogroup">
            <PlanOption
              selected={plan === 'yearly'}
              onPress={() => setPlan('yearly')}
              title={yearly}
              sub={t('family.pluss.yearlySub')}
              badge={t('family.pluss.popular')}
            />
            <PlanOption
              selected={plan === 'monthly'}
              onPress={() => setPlan('monthly')}
              title={monthly}
              sub={t('family.pluss.monthlySub')}
            />
          </View>

          {isAdult ? (
            <>
              <Button variant="magne" label={t('family.pluss.try')} onPress={buy} loading={busy === 'buy'} />
              <Text style={[styles.small, styles.center, { color: tokens.textSecondary }]}>{t('family.pluss.fine')}</Text>
            </>
          ) : (
            <Text style={[styles.body, styles.center, { color: tokens.textSecondary }]}>
              {adults.length
                ? t('family.pluss.askAdult', { names: adults.join(', ') })
                : t('family.pluss.adultsOnly')}
            </Text>
          )}
        </>
      )}

      {isAdult ? (
        <Button
          variant="ghost"
          label={t('family.pluss.restore')}
          onPress={restore}
          loading={busy === 'restore'}
        />
      ) : null}

      <View style={styles.legal}>
        <Pressable onPress={() => router.push(TERMS_ROUTE)} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: tokens.textSecondary }]}>{t('family.me.terms')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push(PRIVACY_ROUTE)} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: tokens.textSecondary }]}>{t('family.me.privacy')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function PlanOption({
  selected,
  onPress,
  title,
  sub,
  badge,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  sub: string;
  badge?: string;
}) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={() => {
        if (!selected) Feel.tick();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${sub}`}
      style={[
        styles.plan,
        { backgroundColor: tokens.paper, borderColor: selected ? tokens.text : tokens.border, borderWidth: selected ? 3 : 2 },
      ]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.planTitle, { color: tokens.text }]}>{title}</Text>
        <Text style={[styles.small, { color: tokens.textSecondary }]}>{sub}</Text>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: tokens.stamp }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2, marginTop: -18 },
  title: { fontFamily: FontFamily.hand, fontSize: 34, lineHeight: 40 },
  lead: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  notes: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  half: { flex: 1 },
  noteTitle: { fontFamily: FontFamily.hand, fontSize: 20, lineHeight: 24 },
  item: { fontFamily: FontFamily.regular, fontSize: 12.5, lineHeight: 17 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17 },
  center: { textAlign: 'center' },
  plans: { gap: 10 },
  plan: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60 },
  planTitle: { fontFamily: FontFamily.extraBold, fontSize: 15 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: FontFamily.extraBold, fontSize: 11.5, color: '#FFFFFF' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  link: { fontFamily: FontFamily.semiBold, fontSize: 12.5, textDecorationLine: 'underline', paddingVertical: 8 },
});
