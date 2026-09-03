import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AuthUser = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
};

type Listener = (session: Session | null) => void;

// `undefined` = not loaded from storage yet, `null` = confirmed signed out.
let currentSession: Session | null | undefined;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(currentSession ?? null);
}

// supabase-js persists to SecureStore and silently refreshes in the background (see
// src/lib/supabase.ts) - we just mirror whatever session it currently holds.
supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
  notify();
});

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionSnapshot() {
  return currentSession ?? null;
}

export async function loadPersistedSession(): Promise<Session | null> {
  if (currentSession !== undefined) return currentSession;
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  notify();
  return currentSession;
}

export function getUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const metadata = session.user.user_metadata ?? {};
  return {
    sub: session.user.id,
    name: (metadata.full_name as string) ?? (metadata.name as string) ?? undefined,
    email: session.user.email,
    picture: (metadata.avatar_url as string) ?? (metadata.picture as string) ?? undefined,
  };
}

/**
 * Returns a currently-valid access token. supabase-js's getSession() transparently
 * refreshes an expired session before returning.
 *
 * The retry is for a specific gap, not for flakiness: supabase-js briefly holds no
 * session while it swaps tokens, and Sign in with Apple walks straight into it - the
 * sign-in handler calls updateUser() and refreshSession() to persist the name, and the
 * very first /api/me fires in the same moment. Failing there threw "Not signed in"
 * before any request was made, which the app rendered as "Får ikke kontakt" instantly,
 * on a working network and a healthy backend.
 */
export async function getValidIdToken(): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.access_token;
    // Genuinely signed out is handled by the navigator, which never renders anything
    // that calls this - so waiting a moment costs nothing real.
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error('Not signed in');
}

export async function clearSession() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Revoking the session server-side needs the network, and it must not be able to
    // trap someone in a signed-in app: falling back to a local sign-out always clears
    // the tokens on this device, and the refresh token expires on its own.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
}
