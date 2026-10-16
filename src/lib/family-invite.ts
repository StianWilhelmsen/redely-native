/**
 * The public join link. Opens the app at /join/[code] when installed (universal link),
 * or the web landing page that sends people to the store when it is not.
 */
export const JOIN_BASE_URL = 'https://magneten.app/bli-med/';

export function joinUrl(code: string): string {
  return `${JOIN_BASE_URL}${encodeURIComponent(code)}`;
}

/** Turns anything typed or pasted (a bare code, a link, lowercase) into the bare code. */
export function parseJoinCode(raw: string): string {
  const trimmed = raw.trim();
  const fromLink = trimmed.match(/bli-med\/([A-Za-z0-9]+)/);
  const code = (fromLink ? fromLink[1] : trimmed).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.slice(0, 12);
}
