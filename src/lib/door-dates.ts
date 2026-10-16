/**
 * Date helpers for the door, notes and activity screens. The household lives in Oslo
 * time, whatever timezone the phone is in, so "today" and "now" are always read in
 * Europe/Oslo. Calendar dates ("YYYY-MM-DD") are handled as plain strings and only turned
 * into a Date at noon UTC when they need formatting, so no offset can shift the day.
 */

import type { DateString, TimeString, Timestamp, Weekday } from '@/api';

export const OSLO = 'Europe/Oslo';

export type Lang = 'nb' | 'en';

export function intlLocale(lang: string): string {
  return lang === 'en' ? 'en-GB' : 'nb-NO';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The Oslo calendar date and minutes-since-midnight for an instant. */
export function osloNow(at: Date = new Date()): { date: DateString; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: OSLO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    date: `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`,
    minutes: (get('hour') % 24) * 60 + get('minute'),
  };
}

function toUtcNoon(ds: DateString): Date {
  const [y, m, d] = ds.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(ds: DateString, days: number): DateString {
  const d = toUtcNoon(ds);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateString, to: DateString): number {
  return Math.round((toUtcNoon(to).getTime() - toUtcNoon(from).getTime()) / 86_400_000);
}

const WEEKDAYS: Weekday[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
/** Monday first, the way a Norwegian week reads. */
export const WEEK_ORDER: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function weekdayOf(ds: DateString): Weekday {
  return WEEKDAYS[toUtcNoon(ds).getUTCDay()];
}

/** The Oslo calendar date of a server timestamp. */
export function dateOfTimestamp(ts: Timestamp): DateString {
  return osloNow(new Date(ts)).date;
}

export function minutesOfTime(time: TimeString): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesOfTimestamp(ts: Timestamp): number {
  return osloNow(new Date(ts)).minutes;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Torsdag 22. oktober" / "Thursday 22 October". */
export function formatLongDate(ds: DateString, lang: string): string {
  const text = new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: OSLO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(toUtcNoon(ds));
  return capitalize(text.replace(',', ''));
}

/** "fre. 23. okt." / "Fri 23 Oct". */
export function formatShortDate(ds: DateString, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: OSLO,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(toUtcNoon(ds))
    .replace(',', '');
}

/** "torsdag" / "Thursday". */
export function formatWeekday(ds: DateString, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: OSLO, weekday: 'long' }).format(toUtcNoon(ds));
}

/** "17:30", in Oslo time. */
export function formatTime(ts: Timestamp, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: OSLO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ts));
}

/** A stable small tilt per note (degrees), so a note hangs the same way every time. */
export function noteTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const steps = [-2.5, -2, -1.5, -1, 1, 1.5, 2, 2.5];
  return steps[Math.abs(hash) % steps.length];
}

/** 2000 øre → "20", 2050 → "20,50" (nb) / "20.50" (en). */
export function formatKr(ore: number, lang: string): string {
  const kr = ore / 100;
  return new Intl.NumberFormat(intlLocale(lang), {
    minimumFractionDigits: Number.isInteger(kr) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(kr);
}

/** "20" / "20,5" / "20.50" → øre, or null when empty or not a number. */
export function parseKr(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
