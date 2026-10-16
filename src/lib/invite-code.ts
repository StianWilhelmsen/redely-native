/**
 * Invite codes are 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no easily
 * confused glyphs), case-insensitive on input, valid 7 days (docs/API.md › Invites).
 *
 * What people share is a link, https://magneten.app/bli-med/<CODE>; the app opens it at
 * `join/[code]`. Entry accepts either the bare code or a pasted link.
 */

export const INVITE_CODE_LENGTH = 6;

export const INVITE_LINK_BASE = 'https://magneten.app/bli-med/';

const ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

/** For display: the bare code, upper-cased. */
export function formatInviteCode(code: string): string {
  return code.toUpperCase();
}

/**
 * Turns anything a keyboard or a paste can produce into the bare code the API expects:
 * a link is cut down to the part after `/bli-med/` (or `/join/`), then everything outside
 * the code alphabet is dropped.
 */
export function normalizeInviteCode(raw: string): string {
  const trimmed = raw.trim();
  const fromLink = trimmed.match(/(?:bli-med|join)\/([A-Za-z0-9-]+)/);
  const source = fromLink ? fromLink[1] : trimmed;
  return source.toUpperCase().replace(ALPHABET, '').slice(0, INVITE_CODE_LENGTH);
}

export function isCompleteInviteCode(code: string): boolean {
  return normalizeInviteCode(code).length === INVITE_CODE_LENGTH;
}

/** The link that goes into the share sheet and the QR code. */
export function inviteLink(code: string): string {
  return `${INVITE_LINK_BASE}${formatInviteCode(code)}`;
}
