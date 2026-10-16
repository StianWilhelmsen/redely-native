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

import { authErrorMessage, LocalizedAuthError } from '@/lib/auth-errors';
import {
  clearSession,
  getSessionSnapshot,
  getUser,
  loadPersistedSession,
  subscribe,
  type AuthUser,
} from '@/lib/auth-store';
import { clearPushToken } from '@/lib/push-notifications';
import { rememberLastSignIn, rememberProviderName, type SignInMethod } from '@/lib/provider-profile';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = 'google' | 'apple';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** The last Apple/Google failure, already in the app's language. */
  signInError: string | null;
  clearSignInError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /**
   * Passwordless email: mails a 6-digit code. Signing in and signing up are the same
   * thing - an unknown address gets an account. Throws a readable message.
   */
  sendEmailCode: (email: string) => Promise<void>;
  /** Exchanges the code for a session (the person is signed in). Throws a readable message. */
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Remembers how this phone signed in, for the one-tap "Fortsett som …" card. */
function rememberSession(method: SignInMethod, session: Session | null | undefined, name?: string) {
  const user = getUser(session ?? null);
  rememberLastSignIn({ method, name: name || user?.name || null, email: user?.email ?? null }).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // A path is required: matches the callback URL registered with each OAuth provider
  // - "ryddigkollektivnative://callback".
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
    if (!access_token || !refresh_token) return null;

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data.session;
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      setSignInError(null);
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data.url) throw error ?? new LocalizedAuthError('couldNotStart');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          const next = await createSessionFromUrl(result.url);
          if (next) rememberSession(provider, next);
        }
      } catch (err) {
        console.warn(`${provider} sign-in failed`, err);
        setSignInError(authErrorMessage(err));
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
      if (!credential.identityToken) throw new LocalizedAuthError('noAppleToken');

      // Only present on the first-ever authorization for this Apple ID - stash it before
      // anything can fail, see src/lib/provider-profile.ts.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter((part): part is string => !!part?.trim())
        .join(' ');
      if (fullName) await rememberProviderName(fullName);

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      rememberSession('apple', data.session, fullName);

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
      setSignInError(authErrorMessage(err));
    }
  }, [signInWithOAuth]);

  const sendEmailCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    if (error) {
      console.warn('email code request failed', error);
      throw new Error(authErrorMessage(error, 'sendFailed'));
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (error) throw new Error(authErrorMessage(error, 'wrongCode'));
    rememberSession('email', data.session);
  }, []);

  const clearSignInError = useCallback(() => setSignInError(null), []);

  const { mutate } = useSWRConfig();

  const signOut = useCallback(async () => {
    // Releasing the device's push token has to go first, because the request needs a
    // session that still works. But it goes over the network, and awaiting that outright
    // left the button doing nothing for as long as the request took to give up - which
    // reads as broken, so people press it again. Two seconds, then sign out regardless: a
    // stale token is corrected the next time anyone signs in on this device.
    await Promise.race([
      clearPushToken(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    await clearSession();
    // Purge the SWR cache: without this, the next account to sign in on this device is
    // served the previous account's cached data ('me' included) while revalidation is
    // in flight.
    await mutate(() => true, undefined, { revalidate: false });
  }, [mutate]);

  const user = useMemo(() => getUser(session), [session]);

  const status: AuthStatus = !hasLoaded ? 'loading' : session ? 'signedIn' : 'signedOut';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInError,
      clearSignInError,
      signInWithGoogle,
      signInWithApple,
      sendEmailCode,
      verifyEmailCode,
      signOut,
    }),
    [
      status,
      user,
      signInError,
      clearSignInError,
      signInWithGoogle,
      signInWithApple,
      sendEmailCode,
      verifyEmailCode,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
