import { addDays, localDateKey, parseDueDateLocal, startOfWeekMonday } from '@/lib/date-utils';

describe('startOfWeekMonday', () => {
  it.each([
    ['2026-09-07', '2026-09-07'], // Monday stays
    ['2026-09-09', '2026-09-07'], // Wednesday
    ['2026-09-13', '2026-09-07'], // Sunday belongs to the week that started the Monday before
  ])('%s -> %s', (input, expected) => {
    expect(localDateKey(startOfWeekMonday(parseDueDateLocal(input)!))).toBe(expected);
  });
});

describe('parseDueDateLocal', () => {
  it('reads a yyyy-MM-dd key as a local date, not UTC midnight', () => {
    const d = parseDueDateLocal('2026-09-09')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 9]);
  });

  it('returns null for nothing', () => {
    expect(parseDueDateLocal(null)).toBeNull();
    expect(parseDueDateLocal('')).toBeNull();
  });
});

describe('addDays', () => {
  it('crosses a month boundary and normalises to midnight', () => {
    const d = addDays(new Date(2026, 8, 30, 15, 30), 1);
    expect(localDateKey(d)).toBe('2026-10-01');
    expect(d.getHours()).toBe(0);
  });
});
