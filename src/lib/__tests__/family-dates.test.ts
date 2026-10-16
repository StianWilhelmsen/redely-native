import {
  ageFromBirthYear,
  formatKroner,
  isThisMonth,
  isThisWeek,
  mondayOf,
  osloDate,
  sundayOf,
} from '../family-dates';
import { parseJoinCode } from '../family-invite';

describe('family-dates', () => {
  it('reads the Oslo calendar date, not the UTC one', () => {
    // 23:30 UTC on 20 Oct is 01:30 on 21 Oct in Oslo (CEST).
    expect(osloDate(new Date('2026-10-20T23:30:00Z'))).toBe('2026-10-21');
    expect(osloDate('2026-10-21T00:15:00+02:00')).toBe('2026-10-21');
  });

  it('finds Monday and Sunday of a week', () => {
    expect(mondayOf('2026-10-16')).toBe('2026-10-12'); // Friday
    expect(mondayOf('2026-10-12')).toBe('2026-10-12'); // Monday itself
    expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // Sunday belongs to the week before
    expect(sundayOf('2026-10-16')).toBe('2026-10-18');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // across a year
  });

  it('knows this week and this month in Oslo', () => {
    const now = new Date('2026-10-16T12:00:00+02:00');
    expect(isThisWeek('2026-10-12T00:05:00+02:00', now)).toBe(true);
    expect(isThisWeek('2026-10-11T23:55:00+02:00', now)).toBe(false);
    expect(isThisWeek(null, now)).toBe(false);
    expect(isThisMonth('2026-10-01T00:01:00+02:00', now)).toBe(true);
    expect(isThisMonth('2026-09-30T23:59:00+02:00', now)).toBe(false);
  });

  it('formats øre as kroner', () => {
    expect(formatKroner(2000, 'nb')).toBe('20');
    expect(formatKroner(1250, 'en')).toBe('12.50');
  });

  it('works out an age', () => {
    const now = new Date('2026-10-16T12:00:00+02:00');
    expect(ageFromBirthYear(2017, now)).toBe(9);
    expect(ageFromBirthYear(null, now)).toBeNull();
  });
});

describe('parseJoinCode', () => {
  it('accepts a bare code, lowercase or a whole link', () => {
    expect(parseJoinCode(' k7mx2q ')).toBe('K7MX2Q');
    expect(parseJoinCode('https://magneten.app/bli-med/K7MX2Q')).toBe('K7MX2Q');
    expect(parseJoinCode('')).toBe('');
  });
});
