import Constants from 'expo-constants';

/** Port the backend binds locally - application.properties uses ${PORT:8080}. */
const LOCAL_API_PORT = 8080;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env, fill in real values, and restart the dev server.`
    );
  }
  return value;
}

/**
 * Dev-only fallback for the API host: Metro already knows the machine's LAN address
 * (`hostUri` is the dev server the phone is talking to, e.g. "10.0.0.13:8081"), so the
 * backend on that same machine is reachable at the same host on the backend's port.
 *
 * This exists so a local run doesn't depend on someone hand-editing an IP into .env every
 * time the router hands out a new lease - a stale address there fails as "the app can't
 * reach the backend", which looks nothing like its actual cause. Release builds never get
 * here: EXPO_PUBLIC_API_URL is always supplied by eas.json.
 */
function localApiUrlFromMetroHost(): string | undefined {
  if (!__DEV__) return undefined;
  // `hostUri` is how a native client reaches Metro, so it carries the machine's LAN
  // address. On web there is no manifest and no hostUri - but the page was itself served
  // by that same dev server, so its own hostname is the equivalent answer.
  const host =
    Constants.expoConfig?.hostUri?.split(':')[0] ??
    (typeof window !== 'undefined' ? window.location?.hostname : undefined);
  return host ? `http://${host}:${LOCAL_API_PORT}` : undefined;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ),
  apiUrl: required(
    'EXPO_PUBLIC_API_URL',
    process.env.EXPO_PUBLIC_API_URL ?? localApiUrlFromMetroHost()
  ),
  // Deliberately NOT required(): unlike the values above, the app is meaningfully usable
  // without this one (chat, tasks, everything except actually buying a subscription).
  // Throwing here would crash the entire app on every dev machine and CI build until
  // someone pastes in a RevenueCat key - src/lib/purchases.ts checks for this itself and
  // no-ops with a clear error only when a purchase is actually attempted.
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
};
