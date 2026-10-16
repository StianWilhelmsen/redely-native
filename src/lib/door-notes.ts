/**
 * What goes on the door today, and what is "next now". Pure functions so the rules can
 * be tested without rendering anything.
 */

import type { DateString, EventOccurrence, Member, Note, PaperDto } from '@/api';
import { dateOfTimestamp, minutesOfTime, minutesOfTimestamp } from '@/lib/door-dates';

import type { Paper } from '@/components/magneten/note';

/** Open notes due today or earlier, and open notes without a date. */
export function isDoorNote(note: Note, today: DateString): boolean {
  return !note.completedAt && (!note.dueDate || note.dueDate <= today);
}

/**
 * The order the server uses for open notes: by date (undated last), then time (untimed
 * last within a day), then creation. Stable whether a note is done or not, so ticking one
 * off never makes the door jump.
 */
export function compareDoorNotes(a: Note, b: Note): number {
  const da = a.dueDate ?? '9999-12-31';
  const db = b.dueDate ?? '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.dueTime ?? '99:99';
  const tb = b.dueTime ?? '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/**
 * Today's door: open door notes plus the ones finished today (so their "gjort!" stamp
 * stays up until tomorrow). A done note wins over an open copy with the same id.
 */
export function buildDoor(open: Note[], done: Note[], today: DateString): Note[] {
  const byId = new Map<string, Note>();
  for (const n of open) if (isDoorNote(n, today)) byId.set(n.id, n);
  for (const n of done) {
    if (n.completedAt && dateOfTimestamp(n.completedAt) === today) byId.set(n.id, n);
  }
  return [...byId.values()].sort(compareDoorNotes);
}

export type NextUp =
  | { kind: 'note'; minutesAway: number; time: string; note: Note }
  | { kind: 'event'; minutesAway: number; time: string; occurrence: EventOccurrence };

/**
 * The next thing that needs someone: the first open note with a time later today, or an
 * event starting within `horizon` minutes - whichever comes first.
 */
export function pickNextUp(
  notes: Note[],
  occurrences: EventOccurrence[],
  today: DateString,
  nowMinutes: number,
  horizon = 240
): NextUp | null {
  const candidates: NextUp[] = [];
  for (const note of notes) {
    if (note.completedAt || note.dueDate !== today || !note.dueTime) continue;
    const at = minutesOfTime(note.dueTime);
    if (at >= nowMinutes) candidates.push({ kind: 'note', minutesAway: at - nowMinutes, time: note.dueTime, note });
  }
  for (const occurrence of occurrences) {
    if (occurrence.event.allDay || dateOfTimestamp(occurrence.startsAt) !== today) continue;
    const at = minutesOfTimestamp(occurrence.startsAt);
    if (at >= nowMinutes && at - nowMinutes <= horizon) {
      const time = `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
      candidates.push({ kind: 'event', minutesAway: at - nowMinutes, time, occurrence });
    }
  }
  candidates.sort((a, b) => a.minutesAway - b.minutesAway);
  return candidates[0] ?? null;
}

export function paperOf(dto: PaperDto): Paper {
  return dto.toLowerCase() as Paper;
}

export function paperDtoOf(paper: Paper): PaperDto {
  return paper.toUpperCase() as PaperDto;
}

/** API.md › Roles: adults may do anything to a visible note; others only their own. */
export function canEditNote(note: Note, me: Member | undefined, isAdult: boolean): boolean {
  return isAdult || (!!me && note.createdByMemberId === me.id);
}

/** Complete / uncomplete / tick: adults always; others if creator, assignee or unassigned. */
export function canCompleteNote(note: Note, me: Member | undefined, isAdult: boolean): boolean {
  if (isAdult) return true;
  if (!note.assigneeMemberId) return true;
  return !!me && (note.assigneeMemberId === me.id || note.createdByMemberId === me.id);
}
