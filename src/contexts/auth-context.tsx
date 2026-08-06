import * as AuthSession from 'expo-auth-session';
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

import { env } from '@/lib/env';
import {
  exchangeCode,
  getTokensSnapshot,
  getUser,
  loadPersistedTokens,
  clearSession,
  subscribe,
  type AuthUser,
  type StoredTokens,
} from '@/lib/auth-store';
import { clearPushToken } from '@/lib/push-notifications';

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signInError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // A path is required: Auth0's dashboard rejects bare-scheme callback URLs
  // ("ryddigkollektivnative://") as format-invalid, so the standalone redirect
  // must be "ryddigkollektivnative://callback" to be whitelistable at all.
  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'ryddigkollektivnative', path: 'callback' }),
    []
  );
  const discovery = AuthSession.useAutoDiscovery(`https://${env.auth0Domain}`);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: env.auth0ClientId,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: env.auth0Audience ? { audience: env.auth0Audience } : undefined,
    },
    discovery
  );

  const [tokens, setTokensState] = useState<StoredTokens | null>(() => getTokensSnapshot());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => subscribe(setTokensState), []);

  useEffect(() => {
    loadPersistedTokens().finally(() => setHasLoaded(true));
  }, []);

  useEffect(() => {
    if (!response || response.type !== 'success' || !request?.codeVerifier) return;

    setSignInError(null);
    exchangeCode(response.params.code, redirectUri, request.codeVerifier).catch((err) => {
      console.warn('Auth0 sign-in failed', err);
      setSignInError(err instanceof Error ? err.message : 'Sign-in failed');
    });
  }, [response, request, redirectUri]);

  const signIn = useCallback(async () => {
    setSignInError(null);
    await promptAsync();
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    // Must happen before clearSession() - clearing the token needs a still-valid
    // session to authenticate the request. Best-effort: sign-out proceeds either way.
    await clearPushToken();
    await clearSession();
  }, []);

  const user = useMemo(() => getUser(tokens), [tokens]);

  const status: AuthStatus = !hasLoaded ? 'loading' : tokens ? 'signedIn' : 'signedOut';

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signInError, signIn, signOut }),
    [status, user, signInError, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
