import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearSession,
  getSessionSnapshot,
  getUser,
  loadPersistedSession,
  subscribe,
  type AuthUser,
} from '@/lib/auth-store';
import { clearPushToken } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = 'google' | 'apple';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signInError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // A path is required: matches the callback URL registered with each OAuth provider
  // (and previously with Auth0) - "ryddigkollektivnative://callback".
  const redirectTo = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'ryddigkollektivnative', path: 'callback' }),
    []
  );

  // The scheme above only applies to a real build. Under Expo Go this resolves to
  // "exp://<lan-ip>:8081/--/callback" instead, which Supabase rejects unless it's in the
  // redirect allow-list - and the address moves with the network. Printing it beats
  // guessing at what to paste into the dashboard.
  useEffect(() => {
    if (__DEV__) console.log('[auth] OAuth redirect URI:', redirectTo);
  }, [redirectTo]);

  const [session, setSession] = useState<Session | null>(() => getSessionSnapshot());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => subscribe(setSession), []);

  useEffect(() => {
    loadPersistedSession().finally(() => setHasLoaded(true));
  }, []);

  /** Applies the access/refresh tokens Supabase appended to the OAuth redirect URL. */
  const createSessionFromUrl = useCallback(async (url: string) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);
    if (errorCode) throw new Error(errorCode);
    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) return;

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      setSignInError(null);
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data.url) throw error ?? new Error('Kunne ikke starte innlogging');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          await createSessionFromUrl(result.url);
        }
      } catch (err) {
        console.warn(`${provider} sign-in failed`, err);
        setSignInError(err instanceof Error ? err.message : 'Innlogging feilet');
      }
    },
    [redirectTo, createSessionFromUrl]
  );

  const signInWithGoogle = useCallback(() => signInWithOAuth('google'), [signInWithOAuth]);
  const signInWithApple = useCallback(() => signInWithOAuth('apple'), [signInWithOAuth]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setSignInError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSignInError(error.message);
      throw error;
    }
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    setSignInError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setSignInError(error.message);
      throw error;
    }
    // With email confirmation enabled (Supabase's default), signUp succeeds and sends a
    // mail but returns no session - so nothing observable happens: no error, no sign-in,
    // the button just spins and stops. The caller has to say "check your inbox", which it
    // can only do if it's told. Returning the flag rather than reading the project setting
    // keeps this correct whichever way confirmation is configured.
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    // Must happen before clearSession() - clearing the session needs a still-valid
    // one to authenticate the request. Best-effort: sign-out proceeds either way.
    await clearPushToken();
    await clearSession();
  }, []);

  const user = useMemo(() => getUser(session), [session]);

  const status: AuthStatus = !hasLoaded ? 'loading' : session ? 'signedIn' : 'signedOut';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInError,
      signInWithGoogle,
      signInWithApple,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [status, user, signInError, signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
