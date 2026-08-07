import AsyncStorage from '@react-native-async-storage/async-storage';

const OSLO_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

function osloParts(now: Date) {
  const parts = Object.fromEntries(OSLO_CLOCK.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
  };
}

function dateKeyFromUtc(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function currentOsloWeekStart(now = new Date()): string {
  const parts = osloParts(now);
  const date = Date.UTC(parts.year, parts.month - 1, parts.day);
  const weekday = new Date(date).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return dateKeyFromUtc(date - daysSinceMonday * 86_400_000);
}

export function sundaySummaryWeek(now = new Date()): string | null {
  const parts = osloParts(now);
  return parts.weekday === 'Sun' && parts.hour >= 20 ? currentOsloWeekStart(now) : null;
}

function seenKey(userId: number, weekStart: string): string {
  return `weekly-summary-seen:${userId}:${weekStart}`;
}

export async function hasSeenWeeklySummary(userId: number, weekStart: string): Promise<boolean> {
  return (await AsyncStorage.getItem(seenKey(userId, weekStart))) === '1';
}

export async function markWeeklySummarySeen(userId: number, weekStart: string): Promise<void> {
  await AsyncStorage.setItem(seenKey(userId, weekStart), '1');
}
