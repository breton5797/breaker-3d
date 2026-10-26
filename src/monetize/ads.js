// Rewarded ads behind one small interface:
//   available() -> boolean, showRewarded(placement) -> Promise<boolean> (true = reward earned)
// The web build has no ads. The app build passes in the AdMob plugin (see native.js).

const noAds = Object.freeze({
  available: () => false,
  showRewarded: async () => false,
});

/** Serialises calls: only one ad on screen at a time; a second request is refused. */
function oneAtATime(show) {
  let busy = false;
  return async (placement) => {
    if (busy) return false;
    busy = true;
    try {
      return await show(placement);
    } catch {
      return false; // no fill, network error, plugin error: no reward, game goes on
    } finally {
      busy = false;
    }
  };
}

/**
 * @param {{ native:boolean, admob?:object, adUnitId?:string }} opts admob: the
 *   @capacitor-community/admob plugin object; adUnitId: the rewarded ad unit for this platform
 */
export function createAds({ native, admob, adUnitId } = { native: false }) {
  if (!native || !admob || !adUnitId) return noAds;
  return {
    available: () => true,
    showRewarded: oneAtATime(async () => {
      await admob.prepareRewardVideoAd({ adId: adUnitId });
      const reward = await admob.showRewardVideoAd();
      return Boolean(reward && (reward.amount ?? 1) > 0);
    }),
  };
}

/** Dev-only stand-in (?mockads in the URL): a pretend ad that always rewards after a pause. */
export function createMockAds({ delayMs = 800 } = {}) {
  return {
    available: () => true,
    showRewarded: oneAtATime(() => new Promise((resolve) => setTimeout(() => resolve(true), delayMs))),
  };
}
