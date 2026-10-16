import {
  addDays,
  addMinutes,
  isoWeek,
  mondayOf,
  occurrenceDays,
  osloDate,
  osloIso,
  osloTime,
  weekdayOf,
} from '../week-dates';

describe('week-dates', () => {
  it('finds the Monday and ISO week', () => {
    expect(mondayOf('2026-10-22')).toBe('2026-10-19');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(isoWeek('2026-10-19')).toBe(43);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(isoWeek('2024-12-30')).toBe(1);
  });

  it('adds days across months and DST', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(weekdayOf('2026-10-24')).toBe('SATURDAY');
  });

  it('builds ISO strings with the Oslo offset of that day', () => {
    expect(osloIso('2026-10-24', '12:00')).toBe('2026-10-24T12:00:00+02:00');
    expect(osloIso('2026-10-26', '12:00')).toBe('2026-10-26T12:00:00+01:00');
    expect(osloIso('2026-01-05', '00:00')).toBe('2026-01-05T00:00:00+01:00');
    // Spring forward: 02:30 does not exist and rolls into summer time.
    expect(osloIso('2026-03-29', '02:30')).toBe('2026-03-29T03:30:00+02:00');
  });

  it('reads Oslo dates and times from timestamps', () => {
    expect(osloDate('2026-10-21T23:30:00Z')).toBe('2026-10-22');
    expect(osloTime('2026-10-21T17:00:00+02:00')).toBe('17:00');
  });

  it('spreads occurrences over the days they touch', () => {
    expect(occurrenceDays('2026-10-21T17:00:00+02:00', '2026-10-21T18:30:00+02:00')).toEqual(['2026-10-21']);
    expect(occurrenceDays('2026-10-24T00:00:00+02:00', '2026-10-26T00:00:00+01:00')).toEqual([
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('adds minutes within a day', () => {
    expect(addMinutes('17:00', 90)).toBe('18:30');
    expect(addMinutes('23:30', 60)).toBe('23:59');
  });
});
