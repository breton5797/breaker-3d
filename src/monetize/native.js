// The app build's bridges to AdMob (rewarded ads) and the stores (Google Play
// Billing / Apple StoreKit), kept free of plugin imports so they can be tested
// with stand-ins; platform.js passes the real plugin objects in.

/** Google's public test ad units: safe to ship in test builds, never pay out. */
export const AD_UNITS = Object.freeze({
  test: { android: 'ca-app-pub-3940256099942544/5224354917', ios: 'ca-app-pub-3940256099942544/1712485313' },
});
const AD_UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;

/**
 * The rewarded ad unit for a platform: the real one from the build env
 * (VITE_ADMOB_REWARDED_ANDROID / _IOS) when set and well-formed, else Google's test unit.
 * @returns {{ id:string, isTesting:boolean }}
 */
export function adUnitFor(platform, env) {
  const real = env[platform === 'ios' ? 'VITE_ADMOB_REWARDED_IOS' : 'VITE_ADMOB_REWARDED_ANDROID'];
  if (typeof real === 'string' && AD_UNIT_ID.test(real)) return { id: real, isTesting: false };
  return { id: AD_UNITS.test[platform === 'ios' ? 'ios' : 'android'], isTesting: true };
}

/**
 * Consent first (Google's UMP form where the law asks for it), then on iPhone the
 * App Tracking Transparency prompt, then the SDK. Without consent: no ads at all.
 * @returns {Promise<boolean>} whether ads may be requested
 */
export async function startAdMob(admob, platform) {
  try {
    let consent = await admob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') consent = await admob.showConsentForm();
    if (!consent.canRequestAds) return false;
    if (platform === 'ios') {
      const { status } = await admob.trackingAuthorizationStatus();
      if (status === 'notDetermined') await admob.requestTrackingAuthorization();
    }
    await admob.initialize({ maxAdContentRating: 'ParentalGuidance' }); // all-ages game: no teen or mature ads
    return true;
  } catch {
    return false;
  }
}

/** A finished purchase: Android reports purchaseState "1"/"PURCHASED"; iOS lists only valid ones. */
const finished = (p) => p.purchaseState === undefined || p.purchaseState === '1' || p.purchaseState === 'PURCHASED';

/**
 * @param {object} purchases the NativePurchases plugin
 * @param {{ INAPP:string }} types its PURCHASE_TYPE
 * @param {string[]} productIds one-time products to load prices for
 * @returns {Promise<{ price:(id:string)=>string|null, buy:(id:string)=>Promise<boolean>, owned:()=>Promise<string[]> }>}
 */
export async function createNativeBilling(purchases, types, productIds) {
  const prices = new Map();
  const { isBillingSupported } = await purchases.isBillingSupported();
  if (!isBillingSupported) throw new Error('billing unavailable');
  for (const id of productIds) {
    try {
      const { product } = await purchases.getProduct({ productIdentifier: id, productType: types.INAPP });
      if (product?.priceString) prices.set(id, product.priceString);
    } catch {
      // product not set up in the store yet: no price, buying will fail politely
    }
  }
  return {
    price: (id) => prices.get(id) ?? null,
    buy: async (id) => {
      await purchases.purchaseProduct({ productIdentifier: id, productType: types.INAPP, quantity: 1 });
      return true;
    },
    owned: async () => {
      const { purchases: list } = await purchases.getPurchases({ productType: types.INAPP });
      return list.filter(finished).map((p) => p.productIdentifier);
    },
  };
}
