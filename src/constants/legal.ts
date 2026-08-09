/**
 * In-app routes for the legal documents. The text itself lives in legal-content.ts and is
 * rendered by app/legal/[document].tsx.
 *
 * App Store Review Guideline 3.1.2 requires both documents to be linked directly from an
 * auto-renewable subscription's purchase screen, and 5.1.1(i) requires the privacy policy
 * to be reachable "within the app in an easily accessible manner". In-app screens satisfy
 * both - a hosted page is not required for these particular links.
 */
export const TERMS_ROUTE = {
  pathname: '/legal/[document]',
  params: { document: 'vilkar' },
} as const;

export const PRIVACY_ROUTE = {
  pathname: '/legal/[document]',
  params: { document: 'personvern' },
} as const;

/**
 * !!! STILL REQUIRED, STILL MISSING. !!!
 *
 * Separate from the in-app screens above: guideline 5.1.1(i) requires a privacy policy
 * link "in the App Store Connect metadata field" AS WELL AS within the app, and App Store
 * Connect will not accept a submission without that URL. An in-app screen cannot be
 * entered into that field.
 *
 * The text to publish is PRIVACY_DOCUMENT in legal-content.ts - it only needs to be
 * hosted somewhere publicly reachable (GitHub Pages, a Notion public page, any static
 * host) and the URL pasted into App Store Connect.
 */
export const HOSTED_PRIVACY_URL_TODO = null;
