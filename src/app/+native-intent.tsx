/**
 * Incoming links → app routes. Shared invite links look like
 * https://magneten.app/bli-med/K7MX2Q (Norwegian, because people read them); inside the
 * app that screen is /join/[code]. Everything else passes through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const match = path.match(/(?:^|\/)bli-med\/([^/?#]+)/i);
    if (match) return `/join/${encodeURIComponent(match[1])}`;
  } catch {
    // Never let a strange link crash startup.
  }
  return path;
}
