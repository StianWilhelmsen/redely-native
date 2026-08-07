import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  hasSeenWeeklySummary,
  markWeeklySummarySeen,
  sundaySummaryWeek,
} from '@/lib/weekly-summary';

export function WeeklySummaryGate({ userId }: { userId: number }) {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    const openIfReady = async () => {
      const weekStart = sundaySummaryWeek();
      if (!weekStart || pathname === '/weekly-summary') return;
      if (await hasSeenWeeklySummary(userId, weekStart)) return;
      if (!active) return;

      await markWeeklySummarySeen(userId, weekStart);
      if (active) {
        router.push({ pathname: '/weekly-summary', params: { weekStart } });
      }
    };

    openIfReady().catch(() => {});
    const timer = setInterval(() => {
      openIfReady().catch(() => {});
    }, 60_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') openIfReady().catch(() => {});
    });

    return () => {
      active = false;
      clearInterval(timer);
      appState.remove();
    };
  }, [pathname, userId]);

  return null;
}
