import { BASE_PLAN, PLUS_PLAN, planThatFits, trialDaysLeft } from '@/constants/plans';

describe('planThatFits', () => {
  it.each([
    [1, BASE_PLAN],
    [4, BASE_PLAN],
    [6, BASE_PLAN],
    [7, PLUS_PLAN],
    [40, PLUS_PLAN],
    [80, PLUS_PLAN],
  ])('%i members -> %o', (members, plan) => {
    expect(planThatFits(members)).toBe(plan);
  });
});

describe('trialDaysLeft', () => {
  it('rounds a partial day up, so the last day still says 1', () => {
    const inTwelveHours = new Date(Date.now() + 12 * 3_600_000).toISOString();
    expect(trialDaysLeft(inTwelveHours)).toBe(1);
  });

  it('is null once the trial is over or was never set', () => {
    expect(trialDaysLeft(new Date(Date.now() - 1000).toISOString())).toBeNull();
    expect(trialDaysLeft(null)).toBeNull();
  });
});
