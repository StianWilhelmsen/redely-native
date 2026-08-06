// Hermes' URL implementation isn't complete enough for supabase-js - must be imported
// before the client is created. See https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';

// supabase-js expects an AsyncStorage-shaped adapter. Wrapping SecureStore instead of
// AsyncStorage gives the session the same encrypted-at-rest treatment the old Auth0
// tokens had (see the previous src/lib/auth-store.ts).
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // We handle the OAuth redirect ourselves via expo-auth-session/WebBrowser.
    detectSessionInUrl: false,
  },
});
