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
 * Separate from the in-app screens above: guideline 5.1.1(i) requires a privacy policy
 * link "in the App Store Connect metadata field" AS WELL AS within the app, and 3.1.2(c)
 * wants a functional Terms of Use (EULA) link in the App Description (or the EULA field).
 * These hosted pages (the redely-support repo, published via GitHub Pages) are what goes
 * into those App Store Connect fields - an in-app screen cannot be entered there.
 */
export const HOSTED_PRIVACY_URL = 'https://stianwilhelmsen.github.io/redely-support/personvern.html';
export const HOSTED_TERMS_URL = 'https://stianwilhelmsen.github.io/redely-support/vilkar.html';
