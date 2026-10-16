import type { Note, NoteInput } from '@/api';

/**
 * A full NoteInput rebuilt from a note, for PUT (a full replace): change one field
 * without dropping the rest.
 */
export function noteToInput(note: Note, patch: Partial<NoteInput> = {}): NoteInput {
  return {
    title: note.title,
    body: note.body,
    dueDate: note.dueDate,
    dueTime: note.dueTime,
    recurrence: note.recurrence,
    recurrenceWeekdays: note.recurrenceWeekdays,
    assigneeMemberId: note.assigneeMemberId,
    areaId: note.areaId,
    visibility: note.visibility,
    paper: note.paper,
    rewardOre: note.rewardOre,
    checklist: note.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
    ...patch,
  };
}

/** Lowercase paper name for the shared <Note>. */
export function paperOf(note: Note): 'white' | 'yellow' | 'pink' | 'mint' {
  return note.paper.toLowerCase() as 'white' | 'yellow' | 'pink' | 'mint';
}

/** A small, stable tilt per note so the door looks hand-hung, not random on every render. */
export function tiltFor(id: string, max = 1.4): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * max * 2 - max;
}
