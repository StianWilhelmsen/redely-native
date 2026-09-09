/**
 * Supabase speaks English and speaks it to developers: a mistyped password comes back as
 * "Invalid login credentials", which is what the sign-in screen used to put in front of
 * people. This turns the handful of outcomes a sign-in or sign-up can actually have into
 * plain Norwegian, and everything else into one honest fallback rather than a leaked
 * internal string.
 *
 * Matched on `code` first - the stable identifier auth-js has carried since v2.50 - with
 * the message text as a fallback for errors that predate it or come from the network layer
 * rather than the API.
 */

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Feil e-post eller passord.',
  email_not_confirmed:
    'Du må bekrefte e-posten din først. Åpne lenken vi sendte deg, og prøv igjen.',
  user_already_exists: 'Det finnes allerede en konto med denne e-posten. Logg inn i stedet.',
  email_exists: 'Det finnes allerede en konto med denne e-posten. Logg inn i stedet.',
  weak_password: 'Passordet er for svakt. Bruk minst 6 tegn.',
  email_address_invalid: 'Sjekk at e-postadressen er riktig skrevet.',
  validation_failed: 'Sjekk at e-post og passord er fylt ut riktig.',
  over_request_rate_limit: 'For mange forsøk. Vent litt før du prøver igjen.',
  over_email_send_rate_limit: 'Vi har sendt deg flere e-poster allerede. Vent litt før du prøver igjen.',
  signup_disabled: 'Det er ikke mulig å opprette konto akkurat nå.',
  email_provider_disabled: 'Innlogging med e-post er slått av akkurat nå.',
  provider_disabled: 'Denne innloggingsmåten er slått av akkurat nå.',
  user_banned: 'Denne kontoen er sperret.',
  user_not_found: 'Fant ingen konto med denne e-posten.',
  session_expired: 'Økten er utløpt. Logg inn på nytt.',
  otp_expired: 'Lenken er utløpt. Be om en ny.',
  captcha_failed: 'Klarte ikke å bekrefte at du er et menneske. Prøv igjen.',
  same_password: 'Det nye passordet må være et annet enn det gamle.',
  request_timeout: 'Fikk ikke kontakt med serveren. Sjekk nettforbindelsen og prøv igjen.',
};

/** Lower-cased fragments of the English messages, for errors that carry no code. */
const BY_MESSAGE: [fragment: string, norwegian: string][] = [
  ['invalid login credentials', BY_CODE.invalid_credentials],
  ['email not confirmed', BY_CODE.email_not_confirmed],
  ['user already registered', BY_CODE.user_already_exists],
  ['password should be at least', BY_CODE.weak_password],
  ['unable to validate email address', BY_CODE.email_address_invalid],
  ['email rate limit exceeded', BY_CODE.over_email_send_rate_limit],
  ['signups not allowed', BY_CODE.signup_disabled],
  // AuthRetryableFetchError and a plain fetch rejection both land here.
  ['network request failed', BY_CODE.request_timeout],
  ['failed to fetch', BY_CODE.request_timeout],
  ['network error', BY_CODE.request_timeout],
];

const FALLBACK = 'Innlogging feilet. Prøv igjen.';

/** Thrown where we detect the problem ourselves, with a message already meant to be read. */
export class LocalizedAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalizedAuthError';
  }
}

export function authErrorMessage(error: unknown, fallback = FALLBACK): string {
  if (!error) return fallback;
  if (error instanceof LocalizedAuthError) return error.message;

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
