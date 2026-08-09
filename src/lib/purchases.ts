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
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { env } from '@/lib/env';

/** Thrown by purchasePlan when the user backs out of the native purchase sheet - never a
 *  real failure, callers should catch this and simply do nothing (no error alert). */
export class PurchaseCancelledError extends Error {}

/** Thrown when a purchase/restore is attempted before configure() has run - only possible
 *  if EXPO_PUBLIC_REVENUECAT_IOS_KEY was never set, or PurchasesSync hasn't mounted yet. */
export class PurchasesNotConfiguredError extends Error {}

let configured = false;

/** Idempotent - safe to call from multiple places, only the first call does anything.
 *  Called once from PurchasesSync on mount; nothing else in the app should call this. */
export function ensurePurchasesConfigured() {
  if (configured) return;
  if (!env.revenueCatIosApiKey) {
    // Expected on every machine until a real key is pasted into .env / eas.json - not a
    // crash, purchasePlan/restorePurchases below surface a clear error only if someone
    // actually taps the buy button before that happens.
    if (__DEV__) console.warn('[purchases] EXPO_PUBLIC_REVENUECAT_IOS_KEY not set - purchases disabled.');
    return;
  }
  Purchases.configure({ apiKey: env.revenueCatIosApiKey });
  configured = true;
}

/** Switches RevenueCat's active subscriber to this collective. Safe to call repeatedly
 *  with the same id - RevenueCat no-ops a logIn to the id that's already active. */
export async function syncPurchasesIdentity(collectiveId: number) {
  if (!configured) return;
  await Purchases.logIn(String(collectiveId));
}

function isCancelled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as PurchasesError).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

async function fetchProduct(productId: string): Promise<PurchasesStoreProduct> {
  if (!configured) throw new PurchasesNotConfiguredError();
  const products = await Purchases.getProducts([productId]);
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
  const product = await fetchProduct(productId);
  try {
    const result = await Purchases.purchaseStoreProduct(product);
    return result.customerInfo;
  } catch (err) {
    if (isCancelled(err)) throw new PurchaseCancelledError();
    throw err;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  if (!configured) throw new PurchasesNotConfiguredError();
  return Purchases.restorePurchases();
}
