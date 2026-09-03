/**
 * Thin wrapper around react-native-purchases (RevenueCat), mirroring how
 * collective-socket.tsx wraps stompjs: the SDK's specifics (configure-once, error codes,
 * identity sync) live in exactly this one file, everything else calls a small clean API.
 *
 * Identity: RevenueCat's appUserID is set to the *collective's* id, not the signed-in
 * user's - one subscription covers the whole collective (see SubscriptionService on the
 * backend), and RevenueCatWebhookController parses the webhook's app_user_id straight back
 * into a collective id. Configuring this wrong silently attributes purchases to the wrong
 * collective, so PurchasesSync below is the only place logIn() is ever called.
 */
import type {
  CustomerInfo,
  PurchasesError,
  PurchasesStoreProduct,
} from 'react-native-purchases';

import { env } from '@/lib/env';

/** Thrown by purchasePlan when the user backs out of the native purchase sheet - never a
 *  real failure, callers should catch this and simply do nothing (no error alert). */
export class PurchaseCancelledError extends Error {}

/** Thrown when a purchase/restore is attempted before configure() has run - possible if
 *  EXPO_PUBLIC_REVENUECAT_IOS_KEY was never set, or the SDK isn't in this binary. */
export class PurchasesNotConfiguredError extends Error {}

type PurchasesModule = typeof import('react-native-purchases');

let cachedModule: PurchasesModule | null | undefined;

/**
 * RevenueCat is a third-party native module, so it is not part of Expo Go - and a static
 * import would take the whole app down at startup there, before a single screen could be
 * looked at. Requiring it lazily keeps everything except buying a subscription testable
 * in Expo Go, and the purchase paths report themselves as unconfigured instead.
 */
function loadPurchases(): PurchasesModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately not
    // a static import: this must be allowed to fail without taking the app with it.
    cachedModule = require('react-native-purchases') as PurchasesModule;
  } catch {
    if (__DEV__) {
      console.warn('[purchases] react-native-purchases is unavailable (Expo Go?) - purchases disabled.');
    }
    cachedModule = null;
  }
  return cachedModule;
}

let configured = false;

/** Idempotent - safe to call from multiple places, only the first call does anything.
 *  Called once from the root layout on mount; nothing else should call this. */
export function ensurePurchasesConfigured() {
  if (configured) return;
  if (!env.revenueCatIosApiKey) {
    // Expected on every machine until a real key is pasted into .env / eas.json - not a
    // crash, purchasePlan/restorePurchases below surface a clear error only if someone
    // actually taps the buy button before that happens.
    if (__DEV__) console.warn('[purchases] EXPO_PUBLIC_REVENUECAT_IOS_KEY not set - purchases disabled.');
    return;
  }
  const purchases = loadPurchases();
  if (!purchases) return;

  purchases.default.configure({ apiKey: env.revenueCatIosApiKey });
  configured = true;
}

/** Switches RevenueCat's active subscriber to this collective. Safe to call repeatedly
 *  with the same id - RevenueCat no-ops a logIn to the id that's already active. */
export async function syncPurchasesIdentity(collectiveId: number) {
  const purchases = loadPurchases();
  if (!configured || !purchases) return;
  await purchases.default.logIn(String(collectiveId));
}

function isCancelled(err: unknown, purchases: PurchasesModule): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as PurchasesError).code === purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

async function fetchProduct(
  productId: string,
  purchases: PurchasesModule
): Promise<PurchasesStoreProduct> {
  const products = await purchases.default.getProducts([productId]);
  const product = products[0];
  if (!product) {
    throw new Error(`Fant ikke produktet "${productId}" - er det godkjent i App Store Connect ennå?`);
  }
  return product;
}

/** Buys a plan by its App Store Connect / RevenueCat product id. Resolves once the
 *  purchase has gone through and RevenueCat has updated CustomerInfo; the actual grant
 *  (raising the collective's member limit) happens server-side via the RevenueCat
 *  webhook, not here - callers should refetch billing status after this resolves rather
 *  than assume this promise settling means access changed instantly. */
export async function purchasePlan(productId: string): Promise<CustomerInfo> {
  const purchases = loadPurchases();
  if (!configured || !purchases) throw new PurchasesNotConfiguredError();

  const product = await fetchProduct(productId, purchases);
  try {
    const result = await purchases.default.purchaseStoreProduct(product);
    return result.customerInfo;
  } catch (err) {
    if (isCancelled(err, purchases)) throw new PurchaseCancelledError();
    throw err;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const purchases = loadPurchases();
  if (!configured || !purchases) throw new PurchasesNotConfiguredError();
  return purchases.default.restorePurchases();
}
