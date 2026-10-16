/**
 * An invite code that arrived before the app could act on it - a link opened while signed
 * out. The join screen stores it and sends the person to sign in; once they are signed in,
 * onboarding (no household yet) picks it up and goes back to `join/[code]`.
 *
 * Held in memory only: it is used within the same launch, and a code that outlived the
 * process would be one nobody asked for any more.
 */
let pending: string | null = null;

export function setPendingInviteCode(code: string) {
  pending = code;
}

/** Looks without taking - for showing "your invitation is saved" on the sign-in screen. */
export function peekPendingInviteCode(): string | null {
  return pending;
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
