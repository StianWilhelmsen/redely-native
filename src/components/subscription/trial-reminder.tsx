import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { PaywallSheet } from '@/components/subscription/paywall-sheet';
import { trialDaysLeft } from '@/constants/plans';
import { localDateKey } from '@/lib/date-utils';
import type { BillingStatus } from '@/types/api';

const SHOWN_ON_KEY = 'redely.trial-reminder.shown-on';
/** The promise made on the last onboarding step: "Påminnelse 5 dager før slutt." */
const REMIND_FROM_DAYS_LEFT = 5;
const SHOW_DELAY_MS = 1500;

/**
 * Opens the subscription sheet on its own once the free month is nearly over - at most
 * once a day, so "Minn meg på det senere" means tomorrow, not the next tab switch.
 * After the trial has ended the read-only banner on Hjem takes over; this stays quiet.
 */
export function TrialReminder({ billing }: { billing: BillingStatus | undefined }) {
  const [visible, setVisible] = useState(false);

  const daysLeft = billing?.status === 'TRIALING' ? trialDaysLeft(billing.trialEndsAt) : null;
  const due = daysLeft != null && daysLeft <= REMIND_FROM_DAYS_LEFT;

  useEffect(() => {
    if (!due) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const today = localDateKey(new Date());
      try {
        if ((await AsyncStorage.getItem(SHOWN_ON_KEY)) === today) return;
        await AsyncStorage.setItem(SHOWN_ON_KEY, today);
      } catch {
        // Storage trouble should not silence the reminder.
      }
      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, SHOW_DELAY_MS);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [due]);

  return (
    <PaywallSheet
      visible={visible}
      onClose={() => setVisible(false)}
      dismissLabel="Minn meg på det senere"
    />
  );
}
