/**
 * Calendar maths for Uka and the event form, all in Oslo wall-clock terms.
 *
 * Dates travel as "YYYY-MM-DD" strings (the API's DateString) so a day never shifts
 * because the phone sits in another time zone. Arithmetic on them goes through UTC noon,
 * which is the same calendar day everywhere and never hits a DST edge.
 *
 * Building a timestamp: the event form collects an Oslo wall-clock date + time, and
 * `osloIso()` turns that into an ISO string with the offset Oslo actually has on that day
 * (+01:00 in winter, +02:00 in summer). We deliberately do NOT use the device offset:
 * a parent on holiday abroad entering "football 17:00" means 17:00 at home, and the
 * server keeps occurrences on Oslo wall-clock time across DST anyway.
 */

import type { DateString, Timestamp, Weekday } from '@/api';

const OSLO = 'Europe/Oslo';
const DAY_MS = 86_400_000;

export const WEEKDAYS: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function parts(ds: DateString): [number, number, number] {
  const [y, m, d] = ds.split('-').map(Number);
  return [y, m, d];
}

/** UTC noon of an Oslo calendar date - safe to format with timeZone Europe/Oslo. */
export function noonOf(ds: DateString): Date {
  const [y, m, d] = parts(ds);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUtcDate(date: Date): DateString {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(ds: DateString, days: number): DateString {
  return fromUtcDate(new Date(noonOf(ds).getTime() + days * DAY_MS));
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(ds: DateString): number {
  return (noonOf(ds).getUTCDay() + 6) % 7;
}

export function weekdayOf(ds: DateString): Weekday {
  return WEEKDAYS[weekdayIndex(ds)];
}

export function mondayOf(ds: DateString): DateString {
  return addDays(ds, -weekdayIndex(ds));
}

/** ISO-8601 week number (weeks start Monday; week 1 holds the year's first Thursday). */
export function isoWeek(ds: DateString): number {
  const thursday = noonOf(addDays(ds, 3 - weekdayIndex(ds)));
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1, 12);
  return Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
}

type WallParts = { y: number; m: number; d: number; h: number; mi: number };

let osloFormatter: Intl.DateTimeFormat | null | undefined;
function formatter(): Intl.DateTimeFormat | null {
  if (osloFormatter === undefined) {
    try {
      osloFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: OSLO,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      osloFormatter = null;
    }
  }
  return osloFormatter;
}

/** The Oslo wall clock at an instant. Falls back to the device clock without Intl time zones. */
export function osloParts(ms: number): WallParts {
  const f = formatter();
  if (!f) {
    const d = new Date(ms);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes() };
  }
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year, m: out.month, d: out.day, h: out.hour % 24, mi: out.minute };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The Oslo calendar date of an instant (or an ISO timestamp). */
export function osloDate(at: number | Timestamp): DateString {
  const ms = typeof at === 'number' ? at : Date.parse(at);
  const p = osloParts(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** "HH:mm" on the Oslo clock. */
export function osloTime(at: number | Timestamp): string {
  const ms = typeof at === 'number' ? at : Date.parse(at);
  const p = osloParts(ms);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function osloToday(now = Date.now()): DateString {
  return osloDate(now);
}

/** Minutes Oslo is ahead of UTC at an instant. */
function offsetAt(ms: number): number {
  const p = osloParts(ms);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/**
 * "2026-10-24" + "12:00" (Oslo wall clock) → "2026-10-24T12:00:00+02:00".
 * The offset is resolved for that exact moment, so a date on the far side of a DST
 * switch gets its own offset. A time inside the spring-forward gap rolls forward an hour.
 */
export function osloIso(ds: DateString, time: string): Timestamp {
  const [y, m, d] = parts(ds);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  // The two offsets in play around this moment (equal on any day without a switch).
  const before = offsetAt(wall - 12 * 3_600_000);
  const after = offsetAt(wall + 12 * 3_600_000);
  const matches = (o: number) => {
    const p = osloParts(wall - o * 60_000);
    return p.h === h && p.mi === mi && p.d === d;
  };
  // Prefer the earlier instant in the autumn overlap; in the spring gap neither matches
  // and the smaller offset lands an hour later on the clock.
  const offset = matches(Math.max(before, after)) ? Math.max(before, after) : Math.min(before, after);
  const instant = wall - offset * 60_000;
  const p = osloParts(instant);
  const o = offsetAt(instant);
  const sign = o >= 0 ? '+' : '-';
  const abs = Math.abs(o);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Inclusive list of Oslo dates an occurrence touches. All-day `endsAt` is exclusive. */
export function occurrenceDays(startsAt: Timestamp, endsAt: Timestamp): DateString[] {
  const start = Date.parse(startsAt);
  const end = Math.max(start, Date.parse(endsAt) - 1);
  const first = osloDate(start);
  const last = osloDate(end);
  const days: DateString[] = [first];
  let cur = first;
  while (cur < last && days.length < 400) {
    cur = addDays(cur, 1);
    days.push(cur);
  }
  return days;
}

/** Minutes between two "HH:mm" (may be negative). */
export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

/** "HH:mm" + minutes, clamped to the same day (max 23:59). */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// ---- Formatting -----------------------------------------------------------

export function intlLocale(lang: string): string {
  return lang === 'en' ? 'en-GB' : 'nb-NO';
}

export function formatDate(ds: DateString, lang: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: OSLO, ...options }).format(noonOf(ds));
}

/** "Man", "Tir" / "Mon", "Tue" - no trailing period, capitalised. */
export function shortWeekday(ds: DateString, lang: string): string {
  const s = formatDate(ds, lang, { weekday: 'short' }).replace(/\.$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function longWeekday(ds: DateString, lang: string): string {
  const s = formatDate(ds, lang, { weekday: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Lørdag 24. oktober" / "Saturday 24 October". */
export function longDate(ds: DateString, lang: string): string {
  const s = formatDate(ds, lang, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthName(ds: DateString, lang: string): string {
  return formatDate(ds, lang, { month: 'long' });
}

export function dayOfMonth(ds: DateString): number {
  return parts(ds)[2];
}

/** A date string from a device-local Date (as returned by the native picker). */
export function fromLocalDate(d: Date): DateString {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A device-local Date carrying this wall-clock date + time, for the native picker. */
export function toLocalDate(ds: DateString, time = '12:00'): Date {
  const [y, m, d] = parts(ds);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
}

export function localTimeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
