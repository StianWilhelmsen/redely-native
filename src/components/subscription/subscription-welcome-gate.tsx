import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import useSWR from 'swr';

import { hasPurchasedPlan, planForMemberLimit } from '@/constants/plans';
import { api } from '@/lib/api';

const SEEN_KEY = 'redely.subscription-welcome.seen';

/**
 * Shows the household the same welcome the buyer got, without needing the socket: the
 * next time billing status is read - app launch, a pull to refresh, or the live
 * SUBSCRIPTION_UPDATED event when the app happens to be open - a plan bought since the
 * last welcome opens the screen. Once per purchase, keyed on when it was bought, and
 * never for the buyer, who saw it the moment they paid.
 */
export function SubscriptionWelcomeGate() {
  const pathname = usePathname();
  const { data: billing } = useSWR('billing-status', api.billingStatus);

  const startedAt = billing && hasPurchasedPlan(billing.status) ? billing.planStartedAt : null;
  const isPayer = billing?.isPayer ?? true;
  const planId = billing ? planForMemberLimit(billing.maxMembers).id : null;

  useEffect(() => {
    if (!startedAt || isPayer || !planId || pathname === '/subscription-welcome') return;
    let active = true;
    (async () => {
      try {
        if ((await AsyncStorage.getItem(SEEN_KEY)) === startedAt) return;
        await AsyncStorage.setItem(SEEN_KEY, startedAt);
      } catch {
        // Unreadable storage: better to welcome twice than never.
      }
      if (active) router.push({ pathname: '/subscription-welcome', params: { plan: planId } });
    })();
    return () => {
      active = false;
    };
  }, [startedAt, isPayer, planId, pathname]);

  return null;
}
