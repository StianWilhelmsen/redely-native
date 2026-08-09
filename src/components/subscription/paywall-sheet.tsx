import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { hasPurchasedPlan, planForMemberLimit, PLANS, type Plan, type PlanId } from '@/constants/plans';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { PurchaseCancelledError, purchasePlan, restorePurchases } from '@/lib/purchases';

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

function formatRenewalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
}

/** Apple's own subscription management screen - the only place a subscription can actually
 *  be cancelled or have its payment method changed. */
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function openAppleSubscriptions() {
  WebBrowser.openBrowserAsync(APPLE_SUBSCRIPTIONS_URL).catch(() => {
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

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // The plan they're already paying for, if any. Null while trialing - the free month is
  // granted server-side and isn't a purchase, so there's nothing to be "on" yet.
  const currentPlan = useMemo(
    () => (billing && hasPurchasedPlan(billing.status) ? planForMemberLimit(billing.maxMembers) : null),
    [billing]
  );

  // Null until they actively pick something, so the default can follow `currentPlan` once
  // billing loads rather than being frozen to whatever it was on first render.
  const [picked, setPicked] = useState<PlanId | null>(null);
  const selectedPlan = useMemo(() => {
    const id = picked ?? currentPlan?.id ?? 'base';
    return PLANS.find((plan) => plan.id === id)!;
  }, [picked, currentPlan]);

  const isCurrentPlanSelected = currentPlan?.id === selectedPlan.id;
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
            {currentPlan ? 'Abonnementet deres' : 'Velg plan for kollektivet'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Ett abonnement dekker hele kollektivet - del kostnaden som dere vil.
          </ThemedText>

          {currentPlan && billing && (
            <View style={[styles.statusCard, { backgroundColor: `${theme.brand}14`, borderColor: `${theme.brand}35` }]}>
              <Ionicons name="checkmark-circle" size={20} color={theme.brand} />
              <View style={styles.statusText}>
                <ThemedText type="smallBold">{currentPlan.name} er aktivt</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {billing.status === 'CANCELED' && billing.currentPeriodEnd
                    ? `Avsluttes ${formatRenewalDate(billing.currentPeriodEnd)}`
                    : billing.status === 'PAST_DUE'
                      ? 'Betalingen gikk ikke gjennom - sjekk betalingsmåten i App Store'
                      : billing.currentPeriodEnd
                        ? `Fornyes ${formatRenewalDate(billing.currentPeriodEnd)}`
                        : `${billing.memberCount} av ${billing.maxMembers} medlemmer`}
                </ThemedText>
              </View>
            </View>
          )}

          <View style={styles.plans}>
            {PLANS.map((plan) => {
              const isSelected = plan.id === selectedPlan.id;
              const isCurrent = plan.id === currentPlan?.id;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setPicked(plan.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${plan.name}, ${plan.priceNok} kroner per måned, opptil ${plan.memberLimit} medlemmer${isCurrent ? ', nåværende plan' : ''}`}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: isSelected ? theme.brand : theme.border,
                    },
                  ]}>
                  {/* "Anbefalt" is a nudge for someone still choosing - once they're paying
                      for a plan, what matters is which one they're on. */}
                  {(isCurrent || (!currentPlan && plan.id === 'base')) && (
                    <View style={[styles.recommendedPill, { backgroundColor: `${theme.brand}22` }]}>
                      <ThemedText type="small" themeColor="brand" style={styles.recommendedPillText}>
                        {isCurrent ? 'NÅVÆRENDE' : 'ANBEFALT'}
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

          {/* Nothing to buy when the selected plan is the one they're already on - offering
              "Start abonnement" there would either double-charge or silently no-op. */}
          {!isCurrentPlanSelected && (
            <PrimaryButton
              label={
                currentPlan
                  ? `Bytt til ${selectedPlan.name} - ${selectedPlan.priceNok} kr/mnd`
                  : `Start abonnement - ${selectedPlan.priceNok} kr/mnd`
              }
              onPress={handleSubscribe}
              loading={purchasing}
              disabled={restoring}
            />
          )}

          {currentPlan ? (
            // Cancelling and changing payment method can only happen in Apple's own
            // subscription settings - an app can't do it, and Apple expects a way to get
            // there. Restoring is only useful to someone who *isn't* showing as subscribed,
            // so the two swap places rather than stacking.
            <Pressable
              onPress={openAppleSubscriptions}
              style={styles.restoreButton}
              hitSlop={Spacing.two}>
              <ThemedText type="small" themeColor="brand">
                Administrer abonnement
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleRestore}
              disabled={purchasing || restoring}
              style={styles.restoreButton}
              hitSlop={Spacing.two}>
              <ThemedText type="small" themeColor="brand">
                {restoring ? 'Gjenoppretter…' : 'Gjenopprett kjøp'}
              </ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.fineprint}>
            Abonnementet fornyes automatisk hver måned til det sies opp. Se{' '}
            <ThemedText
              type="small"
              themeColor="brand"
              onPress={() => {
                onClose();
                router.push(TERMS_ROUTE);
              }}>
              Vilkår
            </ThemedText>{' '}
            og{' '}
            <ThemedText
              type="small"
              themeColor="brand"
              onPress={() => {
                onClose();
                router.push(PRIVACY_ROUTE);
              }}>
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three,
  },
  statusText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
