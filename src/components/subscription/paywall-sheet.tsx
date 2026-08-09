import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { PurchaseCancelledError, purchasePlan, restorePurchases } from '@/lib/purchases';

type PlanId = 'base' | 'plus';

type Plan = {
  id: PlanId;
  /** Must match the App Store Connect / RevenueCat product id exactly - see
   *  wilhelmsen.project.service.SubscriptionService, which is the source of truth this
   *  mirrors on the client (there's no "list available plans" endpoint; RevenueCat's
   *  fetched offering will eventually replace this static list). */
  productId: string;
  name: string;
  priceNok: number;
  memberLimit: number;
  /** Household size used for the "ca. X kr hver" line - illustrative, not the plan's
   *  actual cap (dividing Pluss's 79kr by its real 50-person ceiling would read as an
   *  absurd, misleading price). */
  examplePeopleCount: number;
  recommended?: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'base',
    productId: 'collective_monthly_base',
    name: 'Kollektiv Grunn',
    priceNok: 49,
    memberLimit: 6,
    examplePeopleCount: 6,
    recommended: true,
  },
  {
    id: 'plus',
    productId: 'collective_monthly_plus',
    name: 'Kollektiv Pluss',
    priceNok: 79,
    memberLimit: 50,
    examplePeopleCount: 12,
  },
];

function perPersonLabel(plan: Plan): string {
  const perPerson = plan.priceNok / plan.examplePeopleCount;
  const formatted = perPerson.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
  return `Ca. ${formatted} kr hver når dere er ${plan.examplePeopleCount}`;
}

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function openLegalUrl(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {
    Alert.alert('Kunne ikke åpne siden', 'Prøv igjen senere.');
  });
}

/**
 * Bottom sheet for choosing/starting a collective subscription. Purchases go through
 * RevenueCat (see src/lib/purchases.ts) - the actual entitlement grant (raising the
 * collective's member limit) happens server-side via RevenueCatWebhookController once its
 * webhook arrives, not synchronously with the purchase resolving here.
 */
export function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { mutate } = useSWRConfig();
  // Only fetched while the sheet is actually open - no reason to poll billing status from
  // wherever this gets mounted.
  const { data: billing } = useSWR(visible ? 'billing-status' : null, api.billingStatus);

  const [selected, setSelected] = useState<PlanId>('base');
  const selectedPlan = useMemo(() => PLANS.find((plan) => plan.id === selected)!, [selected]);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const daysLeft = billing?.status === 'TRIALING' ? trialDaysLeft(billing.trialEndsAt) : null;

  // The purchase itself only tells RevenueCat about the transaction - the collective's
  // actual member limit is raised server-side once RevenueCatWebhookController processes
  // the resulting webhook, which can lag the purchase by a few seconds. Refetching here
  // gets today's data as soon as it's available rather than showing stale status until
  // something else happens to revalidate 'billing-status'.
  const refreshBilling = () => mutate('billing-status');

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      await purchasePlan(selectedPlan.productId);
      await refreshBilling();
      onClose();
    } catch (err) {
      if (err instanceof PurchaseCancelledError) return;
      Alert.alert(
        'Kjøpet gikk ikke gjennom',
        err instanceof Error ? err.message : 'Prøv igjen senere.'
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      await refreshBilling();
      Alert.alert('Gjenopprettet', 'Tidligere kjøp er hentet inn på nytt.');
    } catch (err) {
      Alert.alert(
        'Fant ingen kjøp å gjenopprette',
        err instanceof Error ? err.message : 'Prøv igjen senere.'
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Lukk"
        />

        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Lukk"
            hitSlop={Spacing.two}
            style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="close" size={18} color={theme.text} />
          </Pressable>

          <ThemedText type="display" style={styles.title}>
            Velg plan for kollektivet
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Ett abonnement dekker hele kollektivet - del kostnaden som dere vil.
          </ThemedText>

          <View style={styles.plans}>
            {PLANS.map((plan) => {
              const isSelected = plan.id === selected;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelected(plan.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${plan.name}, ${plan.priceNok} kroner per måned, opptil ${plan.memberLimit} medlemmer`}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: isSelected ? theme.brand : theme.border,
                    },
                  ]}>
                  {plan.recommended && (
                    <View style={[styles.recommendedPill, { backgroundColor: `${theme.brand}22` }]}>
                      <ThemedText type="small" themeColor="brand" style={styles.recommendedPillText}>
                        ANBEFALT
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.planRow}>
                    <View style={[styles.radio, { borderColor: isSelected ? theme.brand : theme.border }]}>
                      {isSelected && <View style={[styles.radioDot, { backgroundColor: theme.brand }]} />}
                    </View>
                    <View style={styles.planText}>
                      <ThemedText type="smallBold">{plan.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Opptil {plan.memberLimit} medlemmer{plan.id === 'plus' ? ' - for store kollektiv' : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="brand" style={styles.perPerson}>
                        {perPersonLabel(plan)}
                      </ThemedText>
                    </View>
                    <View style={styles.priceColumn}>
                      <ThemedText type="smallBold" style={styles.priceValue}>
                        {plan.priceNok} kr
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        per måned
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {daysLeft != null && (
            <View style={[styles.trialNote, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.trialDot, { backgroundColor: theme.brand }]} />
              <ThemedText type="small">
                Du har ennå {daysLeft} {daysLeft === 1 ? 'dag' : 'dager'} igjen av gratis prøvemåned
              </ThemedText>
            </View>
          )}

          <PrimaryButton
            label={`Start abonnement - ${selectedPlan.priceNok} kr/mnd`}
            onPress={handleSubscribe}
            loading={purchasing}
            disabled={restoring}
          />

          <Pressable
            onPress={handleRestore}
            disabled={purchasing || restoring}
            style={styles.restoreButton}
            hitSlop={Spacing.two}>
            <ThemedText type="small" themeColor="brand">
              {restoring ? 'Gjenoppretter…' : 'Gjenopprett kjøp'}
            </ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.fineprint}>
            Abonnementet fornyes automatisk hver måned til betalingsmetoden er endret. Se{' '}
            <ThemedText type="small" themeColor="brand" onPress={() => openLegalUrl(TERMS_URL)}>
              Vilkår
            </ThemedText>{' '}
            og{' '}
            <ThemedText type="small" themeColor="brand" onPress={() => openLegalUrl(PRIVACY_URL)}>
              Personvern
            </ThemedText>
            .
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.four,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    paddingRight: Spacing.six, // clears the close button
  },
  subtitle: {
    marginTop: -Spacing.two,
    lineHeight: 20,
  },
  plans: {
    gap: Spacing.two,
  },
  planCard: {
    borderWidth: 2,
    borderRadius: Radii.card,
    padding: Spacing.three,
  },
  recommendedPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    marginBottom: Spacing.two,
  },
  recommendedPillText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  perPerson: {
    marginTop: 2,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 17,
  },
  trialNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  trialDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  restoreButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  fineprint: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
