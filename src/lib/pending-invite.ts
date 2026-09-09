/**
 * An invite code that arrived before the app could act on it - scanned from a QR code
 * while signed out, or before onboarding was finished. Held in memory only: it is used
 * within the same launch, and a code that outlived the process would be one nobody asked
 * for any more.
 */
let pending: string | null = null;

export function setPendingInviteCode(code: string) {
  pending = code;
}

/** Hands the code over and forgets it, so it can only be acted on once. */
export function takePendingInviteCode(): string | null {
  const code = pending;
  pending = null;
  return code;
}

export function clearPendingInviteCode() {
  pending = null;
}
