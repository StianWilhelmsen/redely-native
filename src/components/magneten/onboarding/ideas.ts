/**
 * The suggested first notes in step 6, per kind of home. Each one is a real note with a
 * sensible date/recurrence, not just a title, so the door looks right straight away.
 */

import type { DateString, HouseholdType, NoteInput, PaperDto, Weekday } from '@/api';
import type { Paper } from '@/components/magneten/note';

export type IdeaKey = 'shop' | 'pickup' | 'trash' | 'gift' | 'bathroom' | 'dinner';
export type WhenKey = 'weekend' | 'today16' | 'everyTuesday' | 'beforeSaturday' | 'everySunday' | 'friday';

export type Idea = { key: IdeaKey; when: WhenKey; paper: PaperDto; input: () => Omit<NoteInput, 'title'> };

const WEEKDAYS: Weekday[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Today's date in Oslo, "YYYY-MM-DD". */
export function osloToday(): DateString {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** The next date (today included) that falls on `day`, in Oslo. */
export function nextWeekday(day: Weekday): DateString {
  const [y, m, d] = osloToday().split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  const ahead = (WEEKDAYS.indexOf(day) - base.getUTCDay() + 7) % 7;
  base.setUTCDate(base.getUTCDate() + ahead);
  return base.toISOString().slice(0, 10);
}

const IDEAS: Record<IdeaKey, Idea> = {
  shop: { key: 'shop', when: 'weekend', paper: 'YELLOW', input: () => ({ dueDate: nextWeekday('SATURDAY') }) },
  pickup: { key: 'pickup', when: 'today16', paper: 'WHITE', input: () => ({ dueDate: osloToday(), dueTime: '16:00' }) },
  trash: {
    key: 'trash',
    when: 'everyTuesday',
    paper: 'MINT',
    input: () => ({ dueDate: nextWeekday('TUESDAY'), recurrence: 'WEEKLY', recurrenceWeekdays: ['TUESDAY'] }),
  },
  gift: { key: 'gift', when: 'beforeSaturday', paper: 'PINK', input: () => ({ dueDate: nextWeekday('SATURDAY') }) },
  bathroom: {
    key: 'bathroom',
    when: 'everySunday',
    paper: 'MINT',
    input: () => ({ dueDate: nextWeekday('SUNDAY'), recurrence: 'WEEKLY', recurrenceWeekdays: ['SUNDAY'] }),
  },
  dinner: { key: 'dinner', when: 'friday', paper: 'YELLOW', input: () => ({ dueDate: nextWeekday('FRIDAY') }) },
};

export function ideasFor(type: HouseholdType | undefined): Idea[] {
  const keys: IdeaKey[] =
    type === 'FAMILY' ? ['shop', 'pickup', 'trash', 'gift'] : ['shop', 'trash', 'dinner', 'bathroom'];
  return keys.map((k) => IDEAS[k]);
}

export function paperOf(dto: PaperDto): Paper {
  return dto.toLowerCase() as Paper;
}
