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
  const ads = adsOk ? createAds({ native: true, admob: AdMob, adUnitId: unit.id, isTesting: unit.isTesting }) : createAds({ native: false });
  let store = createStore({ native: false });
  try {
    const billing = await native.createNativeBilling(NativePurchases, PURCHASE_TYPE, [PRODUCT_REMOVE_ADS]);
    store = createStore({ native: true, billing });
  } catch {
    // billing unavailable (no store account on the device): no shop, rewards still work via ads
  }
  return { ads, store };
}

/**
 * @param {{ dev:boolean, search:string, native?:{ platform:'android'|'ios' }|null, env?:object }} options
 * @returns {{ ads: object, store: object, ready: Promise<void> }}
 */
export function createMonetization({ dev, search, native = null, env = {} }) {
  if (dev && new URLSearchParams(search).has('mockads')) {
    return { ads: createMockAds(), store: createStore({ native: true, billing: mockBilling() }), ready: Promise.resolve() };
  }
  const ads = switchable(createAds({ native: false }));
  const store = switchable(createStore({ native: false }));
  const ready = native
    ? nativeMonetization(native.platform, env).then((m) => { ads.set(m.ads); store.set(m.store); }).catch(() => {})
    : Promise.resolve();
  return { ads: ads.proxy, store: store.proxy, ready };
}
