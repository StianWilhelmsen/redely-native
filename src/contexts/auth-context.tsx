import * as AppleAuthentication from 'expo-apple-authentication';
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
import { useSWRConfig } from 'swr';

import {
  clearSession,
  getSessionSnapshot,
  getUser,
  loadPersistedSession,
  subscribe,
  type AuthUser,
} from '@/lib/auth-store';
import { clearPushToken } from '@/lib/push-notifications';
import { rememberProviderName } from '@/lib/provider-profile';
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

  /**
   * Native Sign in with Apple (AuthenticationServices), not the web redirect the other
   * providers use. App Review guideline 4 requires it: the native sheet is what hands back
   * the user's name and email, and an app that has them must not go on to ask for them.
   *
   * Falls back to the web flow only where the native API isn't offered at all (Android,
   * pre-iOS-13), which is also the only place the Apple button is hidden anyway.
   */
  const signInWithApple = useCallback(async () => {
    // Throws rather than returning false when the native module isn't in the binary at
    // all - the state a dev build predating this dependency is in. Both answers mean the
    // same thing here, so both fall back to the web flow instead of dead-ending.
    const nativeAvailable = await AppleAuthentication.isAvailableAsync().catch(() => false);
    if (!nativeAvailable) {
      if (__DEV__) console.log('[auth] Native Sign in with Apple unavailable - using web flow');
      return signInWithOAuth('apple');
    }

    setSignInError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Ingen identitetstoken fra Apple');

      // Only present on the first-ever authorization for this Apple ID - stash it before
      // anything can fail, see src/lib/provider-profile.ts.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter((part): part is string => !!part?.trim())
        .join(' ');
      if (fullName) await rememberProviderName(fullName);

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      // Carry the name onto the Supabase user so later sign-ins - when Apple returns
      // nothing but the user id - still know who this is. refreshSession() re-mints the
      // access token, since the backend reads user_metadata off the JWT's claims and the
      // token issued a moment ago predates this write. Best-effort: onboarding prefills
      // from the stash above regardless.
      if (fullName) {
        try {
          await supabase.auth.updateUser({ data: { full_name: fullName } });
          await supabase.auth.refreshSession();
        } catch (err) {
          console.warn('Could not persist Apple name to user metadata', err);
        }
      }
    } catch (err) {
      // Dismissing the Apple sheet is a normal outcome, not a failure to report.
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      console.warn('apple sign-in failed', err);
      setSignInError(err instanceof Error ? err.message : 'Innlogging feilet');
    }
  }, [signInWithOAuth]);

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

  const { mutate } = useSWRConfig();

  const signOut = useCallback(async () => {
    // Releasing the device's push token has to go first, because the request needs a
    // session that still works. But it also talks to a backend that may be waking from
    // sleep, and awaiting that outright left the button doing nothing for the best part
    // of a minute - which reads as broken, so people press it again. Two seconds, then
    // sign out regardless: a stale token is corrected the next time anyone signs in on
    // this device (see UserController#registerPushToken).
    await Promise.race([
      clearPushToken(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    await clearSession();
    // Purge the SWR cache: without this, the next account to sign in on this device is
    // served the previous account's cached data ('me' included) while revalidation is
    // in flight - which both flashes someone else's household on screen and made the
    // push-token sync fire with a stale user id before the new profile existed.
    await mutate(() => true, undefined, { revalidate: false });
  }, [mutate]);

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
