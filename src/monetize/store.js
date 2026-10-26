// In-app purchase behind one small interface:
//   available(), price(id) -> string|null, buy(id) -> Promise<boolean>, restore() -> Promise<string[]>
// The web build sells nothing. The app build passes in a native billing bridge (see native.js).

/** The one product: a non-consumable that removes ads (rewards then come without an ad). */
export const PRODUCT_REMOVE_ADS = 'remove_ads';

const noStore = Object.freeze({
  available: () => false,
  price: () => null,
  buy: async () => false,
  restore: async () => [],
});

/**
 * @param {{ native:boolean, billing?:{ price:(id:string)=>string|null, buy:(id:string)=>Promise<boolean>,
 *   owned:()=>Promise<string[]> } }} opts billing: the platform purchase bridge
 */
export function createStore({ native, billing } = { native: false }) {
  if (!native || !billing) return noStore;
  return {
    available: () => true,
    price: (id) => billing.price(id),
    buy: async (id) => {
      try { return await billing.buy(id); } catch { return false; } // cancelled or failed
    },
    restore: async () => {
      try { return await billing.owned(); } catch { return []; }
    },
  };
}
