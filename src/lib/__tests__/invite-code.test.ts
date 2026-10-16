import { inviteLink, isCompleteInviteCode, normalizeInviteCode } from '../invite-code';

describe('normalizeInviteCode', () => {
  it('upper-cases and drops spaces and dashes', () => {
    expect(normalizeInviteCode(' k7m x2-q ')).toBe('K7MX2Q');
  });

  it('pulls the code out of a share link', () => {
    expect(normalizeInviteCode('Bli med: https://magneten.app/bli-med/k7mx2q (koden er K7MX2Q)')).toBe('K7MX2Q');
    expect(normalizeInviteCode('https://magneten.app/bli-med/K7MX2Q')).toBe('K7MX2Q');
  });

  it('drops characters outside the code alphabet and caps the length', () => {
    expect(normalizeInviteCode('K7MX2Q99')).toBe('K7MX2Q');
    expect(normalizeInviteCode('O0I1L')).toBe('');
  });

  it('knows a complete code', () => {
    expect(isCompleteInviteCode('k7mx2q')).toBe(true);
    expect(isCompleteInviteCode('K7MX2')).toBe(false);
  });

  it('builds the share link', () => {
    expect(inviteLink('k7mx2q')).toBe('https://magneten.app/bli-med/K7MX2Q');
  });
});
