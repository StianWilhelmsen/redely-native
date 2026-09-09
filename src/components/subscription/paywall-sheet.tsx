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
import {
  hasPurchasedPlan,
  planForMemberLimit,
  planThatFits,
  PLANS,
  trialDaysLeft,
  type Plan,
  type PlanId,
} from '@/constants/plans';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { PurchaseCancelledError, purchasePlan, restorePurchases } from '@/lib/purchases';

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
}

/** "≈ 12 kr per person for dere 4" - the household's own arithmetic, not an example. */
function perPersonForHousehold(plan: Plan, memberCount: number): string | null {
  if (memberCount < 2) return null;
  const perPerson = Math.round(plan.priceNok / memberCount);
  return `≈ ${perPerson} kr per person for dere ${memberCount}`;
}

function planBlurb(plan: Plan): string {
  return plan.id === 'plus'
    ? `Opptil ${plan.memberLimit} medlemmer – for store kollektiv og studenthus.`
    : `Opptil ${plan.memberLimit} medlemmer. Alt dere har brukt i prøveperioden.`;
}

/** Apple's own subscription management screen - the only place a subscription can actually
 *  be cancelled or have its payment method changed. */
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function openAppleSubscriptions() {
  WebBrowser.openBrowserAsync(APPLE_SUBSCRIPTIONS_URL).catch(() => {
    Alert.alert('Kunne ikke åpne siden', 'Prøv igjen senere.');
  });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** What the "not now" action says. The trial reminder opens this sheet unasked, and
   *  there "Minn meg på det senere" is a promise; from Innstillinger it is just a way out. */
  dismissLabel?: string;
};

/**
 * Bottom sheet for choosing/starting a collective subscription. Purchases go through
 * RevenueCat (see src/lib/purchases.ts) - the actual entitlement grant (raising the
 * collective's member limit) happens server-side via RevenueCatWebhookController once its
 * webhook arrives, not synchronously with the purchase resolving here.
 *
 * Two faces: while nobody is paying it asks whether the household wants to carry on,
 * with the numbers filled in for them; once a plan is bought it shows that plan and
 * offers the switch.
 */
export function PaywallSheet({ visible, onClose, dismissLabel = 'Ikke nå' }: Props) {
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
  const memberCount = billing?.memberCount ?? 0;
  const fittingPlan = useMemo(() => planThatFits(memberCount), [memberCount]);

  // Null until they actively pick something, so the default can follow billing once it
  // loads rather than being frozen to whatever it was on first render.
  const [picked, setPicked] = useState<PlanId | null>(null);
  const selectedPlan = useMemo(() => {
    const id = picked ?? currentPlan?.id ?? fittingPlan.id;
    return PLANS.find((plan) => plan.id === id)!;
  }, [picked, currentPlan, fittingPlan]);

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
      // Best effort: the plan is granted by RevenueCat's webhook regardless. This is what
      // lets the backend name the buyer to the rest of the household.
      await api.confirmPurchase(selectedPlan.productId).catch((error) => {
        console.warn('Could not report the purchase to the backend', error);
      });
      await refreshBilling();
      onClose();
      // The welcome screen takes the plan from the sheet rather than from billing: the
      // backend learns about the purchase from RevenueCat's webhook a few seconds later.
      router.push({ pathname: '/subscription-welcome', params: { plan: selectedPlan.id } });
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

  const openLegal = (route: typeof TERMS_ROUTE | typeof PRIVACY_ROUTE) => {
    onClose();
    router.push(route);
  };

  const chip =
    daysLeft != null
      ? `${daysLeft} ${daysLeft === 1 ? 'DAG' : 'DAGER'} IGJEN`
      : billing?.readOnly
        ? 'PRØVEPERIODEN ER OVER'
        : null;

  const intro =
    daysLeft != null && billing?.trialEndsAt
      ? `Prøveperioden slutter ${formatLongDate(billing.trialEndsAt)}. Ett abonnement dekker hele kollektivet – dere deler kostnaden som dere vil.`
      : 'Ett abonnement dekker hele kollektivet – dere deler kostnaden som dere vil.';

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

          {currentPlan ? (
            <>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Lukk"
                hitSlop={Spacing.two}
                style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
              <ThemedText type="display" style={[styles.title, styles.titleWithClose]}>
                Abonnementet deres
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                Ett abonnement dekker hele kollektivet – del kostnaden som dere vil.
              </ThemedText>

              {billing && (
                <View style={[styles.statusCard, { backgroundColor: `${theme.brand}14`, borderColor: `${theme.brand}35` }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.brand} />
                  <View style={styles.statusText}>
                    <ThemedText type="smallBold">{currentPlan.name} er aktivt</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {billing.status === 'CANCELED' && billing.currentPeriodEnd
                        ? `Avsluttes ${formatLongDate(billing.currentPeriodEnd)}`
                        : billing.status === 'PAST_DUE'
                          ? 'Betalingen gikk ikke gjennom – sjekk betalingsmåten i App Store'
                          : billing.currentPeriodEnd
                            ? `Fornyes ${formatLongDate(billing.currentPeriodEnd)}`
                            : `${billing.memberCount} av ${billing.maxMembers} medlemmer`}
                    </ThemedText>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              {chip && (
                <View style={[styles.chip, { backgroundColor: `${theme.brand}1A` }]}>
                  <ThemedText type="small" themeColor="brand" style={styles.chipText}>
                    {chip}
                  </ThemedText>
                </View>
              )}
              <ThemedText type="display" style={styles.title}>
                Vil dere fortsette med Redely?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {intro}
              </ThemedText>
            </>
          )}

          <View style={styles.plans}>
            {PLANS.map((plan) => {
              const isSelected = plan.id === selectedPlan.id;
              const isCurrent = plan.id === currentPlan?.id;
              const fits = !currentPlan && plan.id === fittingPlan.id;
              const perPerson = fits ? perPersonForHousehold(plan, memberCount) : null;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setPicked(plan.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${plan.name}, ${plan.priceNok} kroner per måned, opptil ${plan.memberLimit} medlemmer${isCurrent ? ', nåværende plan' : fits ? ', passer dere' : ''}`}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.background,
                      borderColor: isSelected ? theme.brand : theme.border,
                    },
                  ]}>
                  {/* "Passer dere" is worked out from who lives there; "Nåværende" is a
                      fact. Neither is a sales nudge, so neither goes on the other plan. */}
                  {(isCurrent || fits) && (
                    <View style={[styles.badge, { backgroundColor: theme.brand }]}>
                      <ThemedText type="small" style={[styles.badgeText, { color: theme.onBrand }]}>
                        {isCurrent ? 'Nåværende' : 'Passer dere'}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.planHeader}>
                    <ThemedText type="heading" style={styles.planName}>
                      {plan.name}
                    </ThemedText>
                    <ThemedText style={styles.price}>
                      {plan.priceNok} kr
                      <ThemedText type="small" themeColor="textSecondary">
                        /mnd
                      </ThemedText>
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.planBlurb}>
                    {planBlurb(plan)}
                  </ThemedText>
                  {perPerson && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.perPerson}>
                      {perPerson}
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Nothing to buy when the selected plan is the one they're already on - offering
              "Start abonnement" there would either double-charge or silently no-op. */}
          {!isCurrentPlanSelected && (
            <PrimaryButton
              label={
                currentPlan
                  ? `Bytt til ${selectedPlan.name} – ${selectedPlan.priceNok} kr/mnd`
                  : `Start abonnement – ${selectedPlan.priceNok} kr/mnd`
              }
              size="large"
              onPress={handleSubscribe}
              loading={purchasing}
              disabled={restoring}
            />
          )}

          {currentPlan ? (
            // Cancelling and changing payment method can only happen in Apple's own
            // subscription settings - an app can't do it, and Apple expects a way to get
            // there.
            <Pressable onPress={openAppleSubscriptions} style={styles.secondaryButton} hitSlop={Spacing.two}>
              <ThemedText type="smallBold" themeColor="brand">
                Administrer abonnement
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={onClose}
              disabled={purchasing}
              style={styles.secondaryButton}
              hitSlop={Spacing.two}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {dismissLabel}
              </ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.fineprint}>
            {currentPlan
              ? 'Abonnementet fornyes automatisk hver måned til det sies opp.'
              : 'Fornyes månedlig til det sies opp. Uten abonnement kan dere fortsatt lese alt – men ikke legge inn nytt.'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.fineprint}>
            {!currentPlan && (
              <>
                <ThemedText
                  type="small"
                  themeColor="brand"
                  onPress={purchasing || restoring ? undefined : handleRestore}>
                  {restoring ? 'Gjenoppretter…' : 'Gjenopprett kjøp'}
                </ThemedText>
                {' · '}
              </>
            )}
            <ThemedText type="small" themeColor="brand" onPress={() => openLegal(TERMS_ROUTE)}>
              Vilkår
            </ThemedText>
            {' · '}
            <ThemedText type="small" themeColor="brand" onPress={() => openLegal(PRIVACY_ROUTE)}>
              Personvern
            </ThemedText>
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
  chip: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
  },
  chipText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  titleWithClose: {
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
    gap: Spacing.three,
    paddingTop: Spacing.one,
  },
  planCard: {
    borderWidth: 2,
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three + Spacing.one,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  badge: {
    position: 'absolute',
    top: -11,
    left: Spacing.three,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  planName: {
    flex: 1,
    minWidth: 0,
  },
  price: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  planBlurb: {
    lineHeight: 20,
  },
  perPerson: {
    marginTop: Spacing.one,
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  fineprint: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -Spacing.two,
  },
});
