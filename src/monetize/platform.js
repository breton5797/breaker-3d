// Picks the ad and purchase implementations for where the game is running.
// - Web (GitHub Pages): neither; rewarded offers and the shop stay hidden.
// - Dev builds with ?mockads: pretend ads and a pretend store, for testing the flows.
// - The app (Capacitor): wired in native.js.
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

/**
 * @param {{ dev:boolean, search:string }} env
 * @returns {{ ads: ReturnType<typeof createAds>, store: ReturnType<typeof createStore> }}
 */
export function createMonetization({ dev, search }) {
  if (dev && new URLSearchParams(search).has('mockads')) {
    return { ads: createMockAds(), store: createStore({ native: true, billing: mockBilling() }) };
  }
  return { ads: createAds({ native: false }), store: createStore({ native: false }) };
}
