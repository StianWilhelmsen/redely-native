/**
 * Calendar maths for the family screens. Everything is reckoned on the Oslo calendar,
 * whatever zone the phone is in: "this week" on the fridge door is the household's week.
 */

export const OSLO = 'Europe/Oslo';

/** The Intl locale for the app language. */
export function intlLocale(language: string): 'nb-NO' | 'en-GB' {
  return language === 'en' ? 'en-GB' : 'nb-NO';
}

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: OSLO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "YYYY-MM-DD" on the Oslo calendar for an instant (or an ISO timestamp). */
export function osloDate(at: Date | string = new Date()): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  // en-CA formats as YYYY-MM-DD; parts keep it robust if an engine adds marks.
  const parts = dayFormat.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the week that `day` ("YYYY-MM-DD") falls in. */
export function mondayOf(day: string): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return formatDay(d);
}

/** Sunday of the week that `day` falls in. */
export function sundayOf(day: string): string {
  const d = parseDay(mondayOf(day));
  d.setUTCDate(d.getUTCDate() + 6);
  return formatDay(d);
}

/** Whether the timestamp falls in the same Oslo week (Mon–Sun) as `now`. */
export function isThisWeek(ts: string | null | undefined, now: Date = new Date()): boolean {
  if (!ts) return false;
  return mondayOf(osloDate(ts)) === mondayOf(osloDate(now));
}

/** Whether the timestamp falls in the same Oslo calendar month as `now`. */
export function isThisMonth(ts: string | null | undefined, now: Date = new Date()): boolean {
  if (!ts) return false;
  return osloDate(ts).slice(0, 7) === osloDate(now).slice(0, 7);
}

/** "23. okt." / "23 Oct" - a short date in the app language, Oslo time. */
export function formatShortDate(ts: string, language: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), { timeZone: OSLO, day: 'numeric', month: 'short' }).format(
    new Date(ts)
  );
}

/** "24. oktober 2027" / "24 October 2027". */
export function formatLongDate(ts: string, language: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    timeZone: OSLO,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(ts));
}

/** "oktober 2026" / "October 2026". */
export function formatMonthYear(ts: string, language: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), { timeZone: OSLO, month: 'long', year: 'numeric' }).format(
    new Date(ts)
  );
}

/** The current month's name, "oktober" / "October". */
export function currentMonthName(language: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat(intlLocale(language), { timeZone: OSLO, month: 'long' }).format(now);
}

/** Øre → a whole-krone (or two-decimal) number string in the app language: "20", "12,50". */
export function formatKroner(ore: number, language: string): string {
  const whole = ore % 100 === 0;
  return new Intl.NumberFormat(intlLocale(language), {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(ore / 100);
}

/** Age this year from a birth year - close enough for a fridge door. */
export function ageFromBirthYear(birthYear: number | null | undefined, now: Date = new Date()): number | null {
  if (!birthYear) return null;
  const year = Number(osloDate(now).slice(0, 4));
  const age = year - birthYear;
  return age >= 0 && age < 130 ? age : null;
}
