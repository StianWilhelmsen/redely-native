import * as SecureStore from 'expo-secure-store';

const KEY = 'provider-profile-name';

/**
 * The name an identity provider handed us at sign-in, kept only until onboarding has
 * read it.
 *
 * Apple returns the user's name exactly once - in the response to the very first
 * authorization for this Apple ID + app pair, and never again - so it has to be captured
 * the moment it arrives. It can't be read back off the session either: /api/me may well
 * have already minted the account (from a still-nameless JWT) before the name has been
 * written into user_metadata. Persisting it here rather than holding it in memory keeps
 * it across an app restart mid-onboarding, which is otherwise a one-way loss.
 */
export async function rememberProviderName(name: string) {
  try {
    await SecureStore.setItemAsync(KEY, name);
  } catch {
    // A prefill is a convenience - never let it break sign-in.
  }
}

export async function getRememberedProviderName(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function forgetProviderName() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Ignore - a stale value is only ever used as a prefill.
  }
}
