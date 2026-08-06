import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';
import { decodeJwtPayload } from '@/lib/jwt';

const TOKEN_STORE_KEY = 'ryddig-kollektiv.auth-tokens';

export type StoredTokens = {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms, from the id token's exp claim
};

export type AuthUser = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
};

type Listener = (tokens: StoredTokens | null) => void;

// `undefined` = not loaded from SecureStore yet, `null` = confirmed signed out.
let currentTokens: StoredTokens | null | undefined;
let discoveryPromise: Promise<AuthSession.DiscoveryDocument> | null = null;
const listeners = new Set<Listener>();

function getDiscovery() {
  if (!discoveryPromise) {
    discoveryPromise = AuthSession.fetchDiscoveryAsync(`https://${env.auth0Domain}`);
  }
  return discoveryPromise;
}

function notify() {
  for (const listener of listeners) listener(currentTokens ?? null);
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTokensSnapshot() {
  return currentTokens ?? null;
}

export async function loadPersistedTokens(): Promise<StoredTokens | null> {
  if (currentTokens !== undefined) return currentTokens;
  const raw = await SecureStore.getItemAsync(TOKEN_STORE_KEY);
  currentTokens = raw ? (JSON.parse(raw) as StoredTokens) : null;
  notify();
  return currentTokens;
}

export async function setTokens(tokens: StoredTokens | null) {
  currentTokens = tokens;
  if (tokens) {
    await SecureStore.setItemAsync(TOKEN_STORE_KEY, JSON.stringify(tokens));
  } else {
    await SecureStore.deleteItemAsync(TOKEN_STORE_KEY);
  }
  notify();
}

async function persistFromTokenResult(
  result: { idToken?: string; accessToken?: string; refreshToken?: string },
  fallbackRefreshToken?: string
) {
  const idToken = result.idToken;
  if (!idToken) throw new Error('Auth0 response did not include an idToken');

  const claims = decodeJwtPayload(idToken) as { exp?: number };
  await setTokens({
    idToken,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? fallbackRefreshToken,
    expiresAt: (claims.exp ?? 0) * 1000,
  });
}

export async function exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  const discovery = await getDiscovery();
  const result = await AuthSession.exchangeCodeAsync(
    {
      clientId: env.auth0ClientId,
      code,
      redirectUri,
      extraParams: { code_verifier: codeVerifier },
    },
    discovery
  );
  await persistFromTokenResult(result);
}

async function refresh(refreshToken: string) {
  const discovery = await getDiscovery();
  const result = await AuthSession.refreshAsync(
    { clientId: env.auth0ClientId, refreshToken },
    discovery
  );
  await persistFromTokenResult(result, refreshToken);
}

export function getUser(tokens: StoredTokens | null): AuthUser | null {
  if (!tokens) return null;
  const claims = decodeJwtPayload(tokens.idToken);
  return {
    sub: String(claims.sub),
    name: typeof claims.name === 'string' ? claims.name : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
  };
}

/** Returns a currently-valid idToken, transparently refreshing first if needed. Throws if the session can't be restored. */
export async function getValidIdToken(): Promise<string> {
  const tokens = await loadPersistedTokens();
  if (!tokens) throw new Error('Not signed in');

  if (Date.now() < tokens.expiresAt - 30_000) {
    return tokens.idToken;
  }

  if (!tokens.refreshToken) {
    await setTokens(null);
    throw new Error('Session expired');
  }

  try {
    await refresh(tokens.refreshToken);
  } catch (err) {
    await setTokens(null);
    throw err;
  }

  if (!currentTokens) throw new Error('Session expired');
  return currentTokens.idToken;
}

export async function clearSession() {
  await setTokens(null);
}
