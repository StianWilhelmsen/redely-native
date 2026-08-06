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
 * refreshes an expired session before returning. Throws if the session can't be restored.
 */
export async function getValidIdToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Not signed in');
  return data.session.access_token;
}

export async function clearSession() {
  await supabase.auth.signOut();
}
