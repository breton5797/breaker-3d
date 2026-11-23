// Rewarded ads in the Apps in Toss build (owner, 2026-11-23). Inside a Toss mini-app only Toss's own
// ad SDK may be used (no direct AdMob), through GoogleAdMob.loadAppsInTossAdMob / showAppsInTossAdMob
// of @apps-in-toss/web-framework. Same small interface as ads.js: available(), showRewarded(placement).
// The reward counts only on `userEarnedReward`; `dismissed` alone does not mean the ad was watched.

/** Toss's test ad group (development and review builds). The live group comes from the Toss console. */
export const TOSS_TEST_REWARDED = 'ait-ad-test-rewarded-id';

const supported = (fn) => Boolean(fn && (typeof fn.isSupported !== 'function' || fn.isSupported()));

/** Loads one ad: resolves on `loaded`, rejects on an error. */
function load(admob, adGroupId) {
  return new Promise((resolve, reject) => {
    admob.loadAppsInTossAdMob({
      options: { adGroupId },
      onEvent: (event) => { if (event.type === 'loaded') resolve(); },
      onError: reject,
    });
  });
}

/** Shows the loaded ad: resolves true once it closes after a reward, false when closed without one. */
function show(admob, adGroupId) {
  return new Promise((resolve) => {
    let earned = false;
    let cleanup = () => {};
    const done = (result) => { cleanup(); resolve(result); };
    cleanup = admob.showAppsInTossAdMob({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') earned = true;
        else if (event.type === 'dismissed') done(earned);
        else if (event.type === 'failedToShow') done(false);
      },
      onError: () => done(false),
    }) ?? (() => {});
  });
}

/**
 * @param {{ admob: { loadAppsInTossAdMob: Function, showAppsInTossAdMob: Function }, adGroupId?: string }} opts
 *   admob: GoogleAdMob from @apps-in-toss/web-framework
 */
export function createTossAds({ admob, adGroupId = TOSS_TEST_REWARDED }) {
  const ok = () => supported(admob?.loadAppsInTossAdMob) && supported(admob?.showAppsInTossAdMob);
  let busy = false;
  return {
    available: ok,
    showRewarded: async () => {
      if (busy || !ok()) return false;
      busy = true;
      try {
        await load(admob, adGroupId);
        return await show(admob, adGroupId);
      } catch {
        return false; // no fill, network or bridge error: no reward, the game goes on
      } finally {
        busy = false;
      }
    },
  };
}
