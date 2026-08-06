export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDueDateLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const key = value.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [yy, mm, dd] = key.split('-').map(Number);
    return new Date(yy, mm - 1, dd);
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  x.setHours(0, 0, 0, 0);
  return x;
}

const WEEKDAY_LABELS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];

export function weekdayLabel(d: Date): string {
  return WEEKDAY_LABELS[d.getDay()];
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export function relativeDayLabel(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const today = new Date();
  const key = localDateKey(d);
  if (key === localDateKey(today)) return 'i dag';
  const yesterday = addDays(today, -1);
  if (key === localDateKey(yesterday)) return 'i går';
  return formatShortDate(d);
}
