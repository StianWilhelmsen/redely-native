import type { ActivityEntry, EventOccurrence, Note } from '@/api';
import { groupActivity } from '@/lib/door-activity';
import { addDays, daysBetween, formatKr, noteTilt, osloNow, parseKr, weekdayOf } from '@/lib/door-dates';
import { buildDoor, canCompleteNote, pickNextUp } from '@/lib/door-notes';

const note = (over: Partial<Note>): Note => ({
  id: 'n1',
  title: 'Tømme oppvasken',
  body: null,
  dueDate: null,
  dueTime: null,
  recurrence: 'NONE',
  recurrenceWeekdays: [],
  assigneeMemberId: null,
  areaId: null,
  visibility: 'ALL',
  paper: 'WHITE',
  rewardOre: null,
  completedAt: null,
  completedByMemberId: null,
  createdByMemberId: 'creator',
  createdAt: '2026-10-01T10:00:00+02:00',
  updatedAt: '2026-10-01T10:00:00+02:00',
  checklist: [],
  commentCount: 0,
  ...over,
});

describe('door dates', () => {
  it('reads today in Oslo, not UTC', () => {
    // 23:30 UTC on the 21st is already the 22nd in Oslo (summer time, +02:00).
    expect(osloNow(new Date('2026-10-21T23:30:00Z'))).toEqual({ date: '2026-10-22', minutes: 90 });
  });

  it('adds days across a month end and counts them back', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(weekdayOf('2026-10-22')).toBe('THURSDAY');
  });

  it('turns kroner into øre and back', () => {
    expect(parseKr('20')).toBe(2000);
    expect(parseKr('12,5')).toBe(1250);
    expect(parseKr('')).toBeNull();
    expect(formatKr(2000, 'nb')).toBe('20');
  });

  it('gives a note the same tilt every time', () => {
    expect(noteTilt('abc')).toBe(noteTilt('abc'));
    expect(noteTilt('abc')).not.toBe(0);
  });
});

describe('buildDoor', () => {
  const today = '2026-10-22';
  it('keeps today, overdue and undated open notes, plus notes done today', () => {
    const open = [
      note({ id: 'today', dueDate: today, dueTime: '17:00' }),
      note({ id: 'late', dueDate: '2026-10-20' }),
      note({ id: 'undated' }),
      note({ id: 'future', dueDate: '2026-10-23' }),
    ];
    const done = [
      note({ id: 'doneToday', dueDate: today, completedAt: '2026-10-22T08:00:00+02:00' }),
      note({ id: 'doneBefore', dueDate: '2026-10-21', completedAt: '2026-10-21T08:00:00+02:00' }),
    ];
    expect(buildDoor(open, done, today).map((n) => n.id)).toEqual(['late', 'today', 'doneToday', 'undated']);
  });
});

describe('pickNextUp', () => {
  const today = '2026-10-22';
  const occurrence = (startsAt: string) =>
    ({ eventId: 'e1', startsAt, endsAt: startsAt, event: { id: 'e1', allDay: false, title: 'Fotball' } }) as unknown as EventOccurrence;

  it('picks the soonest of a timed note and an event within the horizon', () => {
    const notes = [note({ id: 'a', dueDate: today, dueTime: '18:00' })];
    const next = pickNextUp(notes, [occurrence('2026-10-22T17:30:00+02:00')], today, 16 * 60 + 50);
    expect(next?.kind).toBe('event');
    expect(next?.minutesAway).toBe(40);
  });

  it('ignores notes whose time has passed', () => {
    const notes = [note({ id: 'a', dueDate: today, dueTime: '08:00' })];
    expect(pickNextUp(notes, [], today, 9 * 60)).toBeNull();
  });
});

describe('canCompleteNote', () => {
  const kid = { id: 'kid' } as never;
  it('lets a child tick their own, unassigned or created notes but not others', () => {
    expect(canCompleteNote(note({ assigneeMemberId: 'kid' }), kid, false)).toBe(true);
    expect(canCompleteNote(note({}), kid, false)).toBe(true);
    expect(canCompleteNote(note({ assigneeMemberId: 'mum' }), kid, false)).toBe(false);
    expect(canCompleteNote(note({ assigneeMemberId: 'mum' }), kid, true)).toBe(true);
  });
});

describe('groupActivity', () => {
  it('splits today from earlier and drops duplicates across pages', () => {
    const entry = (id: number, createdAt: string): ActivityEntry => ({
      id,
      type: 'NOTE_CREATED',
      createdAt,
      actorMemberId: null,
      targetMemberId: null,
      noteId: null,
      eventId: null,
      listId: null,
      subject: 'x',
    });
    const g = groupActivity(
      [entry(3, '2026-10-22T09:00:00+02:00'), entry(2, '2026-10-21T09:00:00+02:00'), entry(2, '2026-10-21T09:00:00+02:00')],
      '2026-10-22'
    );
    expect(g.today.map((e) => e.id)).toEqual([3]);
    expect(g.earlier.map((e) => e.id)).toEqual([2]);
  });
});
