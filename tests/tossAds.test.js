import { describe, it, expect, vi } from 'vitest';
import { createTossAds, TOSS_TEST_REWARDED } from '../src/monetize/tossAds.js';

// Rewarded ads in the Apps in Toss build (owner, 2026-11-23). Only Toss's ad SDK is allowed there;
// the reward is paid on `userEarnedReward` only, never on `dismissed` (Toss guide, AD_MONETIZATION 5).

/** A fake GoogleAdMob from @apps-in-toss/web-framework; `script` lists the show events to play. */
function fakeSdk({ supported = true, loadFails = false, script = ['show', 'userEarnedReward', 'dismissed'], showThrows = false } = {}) {
  const calls = { load: 0, show: 0, cleanups: 0 };
  const load = vi.fn(({ options, onEvent, onError }) => {
    calls.load++;
    calls.lastGroup = options.adGroupId;
    queueMicrotask(() => (loadFails ? onError(new Error('no fill')) : onEvent({ type: 'loaded', data: {} })));
    return () => {};
  });
  load.isSupported = () => supported;
  const show = vi.fn(({ onEvent, onError }) => {
    calls.show++;
    if (showThrows) { queueMicrotask(() => onError(new Error('bridge'))); return () => { calls.cleanups++; }; }
    queueMicrotask(() => script.forEach((type) => onEvent(type === 'userEarnedReward' ? { type, data: { unitType: 'coin', unitAmount: 1 } } : { type })));
    return () => { calls.cleanups++; };
  });
  show.isSupported = () => supported;
  return { sdk: { loadAppsInTossAdMob: load, showAppsInTossAdMob: show }, calls };
}

describe('Apps in Toss rewarded ads', () => {
  it('pays only after userEarnedReward; uses the test ad group unless one is given', async () => {
    const { sdk, calls } = fakeSdk();
    const ads = createTossAds({ admob: sdk });
    expect(ads.available()).toBe(true);
    expect(await ads.showRewarded('revive')).toBe(true);
    expect(calls.lastGroup).toBe(TOSS_TEST_REWARDED);
    expect(calls.cleanups).toBe(1); // the bridge callback is released
  });

  it('closing early, failing to show, a bridge error or no fill pays nothing', async () => {
    for (const opts of [{ script: ['show', 'dismissed'] }, { script: ['failedToShow'] }, { showThrows: true }, { loadFails: true }]) {
      const { sdk } = fakeSdk(opts);
      expect(await createTossAds({ admob: sdk, adGroupId: 'g' }).showRewarded('doubleGold'), JSON.stringify(opts)).toBe(false);
    }
  });

  it('outside the Toss app there are no ads', async () => {
    const { sdk, calls } = fakeSdk({ supported: false });
    const ads = createTossAds({ admob: sdk });
    expect(ads.available()).toBe(false);
    expect(await ads.showRewarded('revive')).toBe(false);
    expect(calls.load).toBe(0);
  });

  it('one ad at a time: a second request while one is up is refused', async () => {
    const { sdk, calls } = fakeSdk();
    const ads = createTossAds({ admob: sdk, adGroupId: 'g' });
    const [a, b] = await Promise.all([ads.showRewarded('revive'), ads.showRewarded('revive')]);
    expect([a, b]).toEqual([true, false]);
    expect(calls.show).toBe(1);
  });
});
