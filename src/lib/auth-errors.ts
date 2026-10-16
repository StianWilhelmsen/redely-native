/**
 * Supabase speaks English and speaks it to developers: a mistyped code comes back as
 * "Token has expired or is invalid". This turns the handful of outcomes a sign-in can
 * actually have into a sentence in the app's language (keys under `auth.errors`), and
 * everything else into one honest fallback rather than a leaked internal string.
 *
 * Matched on `code` first - the stable identifier auth-js has carried since v2.50 - with
 * the message text as a fallback for errors that predate it or come from the network layer
 * rather than the API.
 */

import i18n from '@/i18n';

export type AuthErrorKey =
  | 'generic'
  | 'couldNotStart'
  | 'noAppleToken'
  | 'wrongCode'
  | 'emailInvalid'
  | 'sendFailed'
  | 'rateLimit'
  | 'emailRateLimit'
  | 'signupDisabled'
  | 'emailDisabled'
  | 'providerDisabled'
  | 'banned'
  | 'sessionExpired'
  | 'captcha'
  | 'network';

const BY_CODE: Record<string, AuthErrorKey> = {
  otp_expired: 'wrongCode',
  otp_disabled: 'emailDisabled',
  email_address_invalid: 'emailInvalid',
  validation_failed: 'emailInvalid',
  over_request_rate_limit: 'rateLimit',
  over_email_send_rate_limit: 'emailRateLimit',
  signup_disabled: 'signupDisabled',
  email_provider_disabled: 'emailDisabled',
  provider_disabled: 'providerDisabled',
  user_banned: 'banned',
  session_expired: 'sessionExpired',
  captcha_failed: 'captcha',
  request_timeout: 'network',
};

/** Lower-cased fragments of the English messages, for errors that carry no code. */
const BY_MESSAGE: [fragment: string, key: AuthErrorKey][] = [
  ['token has expired or is invalid', 'wrongCode'],
  ['unable to validate email address', 'emailInvalid'],
  ['email rate limit exceeded', 'emailRateLimit'],
  ['for security purposes, you can only request this', 'emailRateLimit'],
  ['signups not allowed', 'signupDisabled'],
  // AuthRetryableFetchError and a plain fetch rejection both land here.
  ['network request failed', 'network'],
  ['failed to fetch', 'network'],
  ['network error', 'network'],
];

/** Thrown where we detect the problem ourselves, with a message already meant to be read. */
export class LocalizedAuthError extends Error {
  constructor(key: AuthErrorKey) {
    super(i18n.t(`auth.errors.${key}`));
    this.name = 'LocalizedAuthError';
  }
}

export function authErrorKey(error: unknown, fallback: AuthErrorKey = 'generic'): AuthErrorKey {
  if (!error) return fallback;

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code];

  const message = error instanceof Error ? error.message : String(error);
  if (!message) return fallback;

  const lowered = message.toLowerCase();
  const matched = BY_MESSAGE.find(([fragment]) => lowered.includes(fragment));
  if (matched) return matched[1];

  // Anything left is Supabase plumbing, which would only confuse - keep it to the log.
  if (__DEV__) console.warn('[auth] untranslated error', code, message);
  return fallback;
}

export function authErrorMessage(error: unknown, fallback: AuthErrorKey = 'generic'): string {
  if (error instanceof LocalizedAuthError) return error.message;
  return i18n.t(`auth.errors.${authErrorKey(error, fallback)}`);
}
