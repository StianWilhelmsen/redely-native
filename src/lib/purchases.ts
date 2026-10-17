/**
 * Thin wrapper around react-native-purchases (RevenueCat), mirroring how
 * collective-socket.tsx wraps stompjs: the SDK's specifics (configure-once, error codes,
 * identity sync) live in exactly this one file, everything else calls a small clean API.
 *
 * Identity: RevenueCat's appUserID is the *household's* UUID, not the signed-in user's -
 * one Pluss covers the whole household, and the backend's webhook reads app_user_id
 * straight back as a household id. Configuring this wrong silently attributes purchases
 * to the wrong household, so HouseholdProvider is the only place that calls
 * syncPurchasesIdentity.
 */
import { Platform } from 'react-native';
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
 *  the platform's EXPO_PUBLIC_REVENUECAT_*_KEY was never set, or the SDK isn't in this binary. */
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
    // Deliberately not a static import: this must be allowed to fail without taking the
    // app down with it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // RevenueCat keys are per store: an Apple key configured on Android (or vice versa) is
  // rejected by the SDK, so each platform strictly uses its own.
  const apiKey = Platform.select({
    ios: env.revenueCatIosApiKey,
    android: env.revenueCatAndroidApiKey,
  });
  if (!apiKey) {
    // Expected on every machine until a real key is pasted into .env / eas.json - not a
    // crash, purchasePlan/restorePurchases below surface a clear error only if someone
    // actually taps the buy button before that happens.
    if (__DEV__) {
      console.warn(`[purchases] No RevenueCat key for ${Platform.OS} - purchases disabled.`);
    }
    return;
  }
  const purchases = loadPurchases();
  if (!purchases) return;

  purchases.default.configure({ apiKey });
  configured = true;
}

/** Switches RevenueCat's active subscriber to this household. Safe to call repeatedly
 *  with the same id - RevenueCat no-ops a logIn to the id that's already active. */
export async function syncPurchasesIdentity(householdId: string) {
  const purchases = loadPurchases();
  if (!configured || !purchases) return;
  await purchases.default.logIn(householdId);
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
    throw new Error(`Product "${productId}" not found - is it approved in App Store Connect?`);
  }
  return product;
}

/** Buys a plan by its App Store Connect / RevenueCat product id. Resolves once the
 *  purchase has gone through and RevenueCat has updated CustomerInfo; the actual grant
 *  (Pluss for the household) happens server-side via the RevenueCat
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

/** The two Pluss products, as set up in App Store Connect and RevenueCat. */
export const PLUSS_PRODUCTS = {
  yearly: 'magneten_pluss_yearly',
  monthly: 'magneten_pluss_monthly',
} as const;

export type PlussPlan = keyof typeof PLUSS_PRODUCTS;

/** The store's localized price per plan ("399,00 kr"), or null when the store can't be
 *  asked (Expo Go, no API key, products not approved yet) - callers fall back to the
 *  list prices then. Never throws. */
export async function getPlussPrices(): Promise<Partial<Record<PlussPlan, string>> | null> {
  const purchases = loadPurchases();
  if (!configured || !purchases) return null;
  try {
    const products = await purchases.default.getProducts(Object.values(PLUSS_PRODUCTS));
    const prices: Partial<Record<PlussPlan, string>> = {};
    for (const plan of Object.keys(PLUSS_PRODUCTS) as PlussPlan[]) {
      const product = products.find((p) => p.identifier === PLUSS_PRODUCTS[plan]);
      if (product) prices[plan] = product.priceString;
    }
    return Object.keys(prices).length ? prices : null;
  } catch {
    return null;
  }
}
