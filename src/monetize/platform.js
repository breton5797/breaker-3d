// Picks the ad and purchase implementations for where the game is running.
// - Web (GitHub Pages): neither; rewarded offers and the shop stay hidden.
// - Dev builds with ?mockads: pretend ads and a pretend store, for testing the flows.
// - The app (Capacitor on Android/iOS): AdMob rewarded ads and store billing (native.js).
// The returned ads/store start as the web versions and switch over once the
// native side is ready; `ready` resolves then (the title refreshes its shop button).
import { createAds, createMockAds } from './ads.js';
import { createStore, PRODUCT_REMOVE_ADS } from './store.js';

/** A pretend store for dev testing: one product, buying always succeeds. */
function mockBilling() {
  const owned = new Set();
  return {
    price: (id) => (id === PRODUCT_REMOVE_ADS ? '₩3,900' : null),
    buy: async (id) => { owned.add(id); return true; },
    owned: async () => [...owned],
  };
}

/** Forwards every call to whichever implementation is current. */
function switchable(initial) {
  let impl = initial;
  const proxy = new Proxy({}, { get: (_, key) => (...args) => impl[key](...args) });
  return { proxy, set: (next) => { impl = next; } };
}

/** Loads the native plugins and builds the real ads and store (app builds only). */
async function nativeMonetization(platform, env) {
  const [{ AdMob }, { NativePurchases, PURCHASE_TYPE }, native] = await Promise.all([
    import('@capacitor-community/admob'),
    import('@capgo/native-purchases'),
    import('./native.js'),
  ]);
  const unit = native.adUnitFor(platform, env);
  const adsOk = await native.startAdMob(AdMob, platform);
  // Asked after start-up, whatever the consent answer: someone who declined must be able to change it.
  const entry = await native.privacyEntry(AdMob);
  const privacy = { required: () => entry.required, open: entry.open };
  const ads = adsOk ? createAds({ native: true, admob: AdMob, adUnitId: unit.id, isTesting: unit.isTesting }) : createAds({ native: false });
  let store = createStore({ native: false });
  try {
    const billing = await native.createNativeBilling(NativePurchases, PURCHASE_TYPE, [PRODUCT_REMOVE_ADS]);
    store = createStore({ native: true, billing });
  } catch {
    // billing unavailable (no store account on the device): no shop, rewards still work via ads
  }
  return { ads, store, privacy };
}

/** No ads, so nothing to choose (the web build and dev builds). */
const noPrivacy = Object.freeze({ required: () => false, open: async () => false });

/**
 * The Apps in Toss build (2026-11-23): Toss's own rewarded ads only (AdMob may not be used directly
 * in a mini-app). No shop in this first version (owner: ads only; Toss in-app payments later).
 */
async function tossMonetization(loadSdk, env) {
  const [{ GoogleAdMob }, { createTossAds }] = await Promise.all([loadSdk(), import('./tossAds.js')]);
  return { ads: createTossAds({ admob: GoogleAdMob, adGroupId: env.VITE_TOSS_REWARDED || undefined }) };
}

/**
 * @param {{ dev:boolean, search:string, native?:{ platform:'android'|'ios' }|null, env?:object,
 *   toss?: (() => Promise<object>)|null }} options toss: loads @apps-in-toss/web-framework (Toss build only)
 * @returns {{ ads: object, store: object, privacy: { required: () => boolean, open: () => Promise<boolean> }, ready: Promise<void> }}
 */
export function createMonetization({ dev, search, native = null, env = {}, toss = null }) {
  if (dev && new URLSearchParams(search).has('mockads')) {
    return { ads: createMockAds(), store: createStore({ native: true, billing: mockBilling() }), privacy: noPrivacy, ready: Promise.resolve() };
  }
  const ads = switchable(createAds({ native: false }));
  const store = switchable(createStore({ native: false }));
  const privacy = switchable(noPrivacy);
  const ready = toss
    ? tossMonetization(toss, env).then((m) => { ads.set(m.ads); }).catch(() => {}) // no SDK: the game runs without ads
    : native
      ? nativeMonetization(native.platform, env).then((m) => { ads.set(m.ads); store.set(m.store); privacy.set(m.privacy); }).catch(() => {})
      : Promise.resolve();
  return { ads: ads.proxy, store: store.proxy, privacy: privacy.proxy, ready };
}
