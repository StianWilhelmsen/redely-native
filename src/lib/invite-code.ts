/**
 * Invite codes are stored bare on the backend (5 characters from an alphabet that omits
 * easily-confused glyphs, see InviteService) but always shown with a short prefix, as
 * "RYD-K7M2P". The prefix is presentation only: it makes a code recognisable when it is
 * pasted into a group chat among other text, and gives the eye a place to start.
 *
 * Because it is decoration, entry has to accept a code typed either way round.
 */
const PREFIX = 'RYD';

export const INVITE_CODE_LENGTH = 5;

export function formatInviteCode(code: string): string {
  return `${PREFIX}-${code}`;
}

/**
 * Turns anything a keyboard or a paste can produce into the bare code the API expects.
 * The prefix is only stripped when what remains could still be a whole code - the code
 * alphabet contains R, Y and D, so "RYDXX" is a legitimate code in its own right.
 */
export function normalizeInviteCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bare =
    cleaned.startsWith(PREFIX) && cleaned.length > INVITE_CODE_LENGTH
      ? cleaned.slice(PREFIX.length)
      : cleaned;
  return bare.slice(0, INVITE_CODE_LENGTH);
}
