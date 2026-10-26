import { describe, it, expect, beforeEach } from 'vitest';
import { rewardOffers, REVIVES_PER_RUN } from '../src/monetize/rewards.js';
import { createAds, createMockAds } from '../src/monetize/ads.js';
import { createStore, PRODUCT_REMOVE_ADS } from '../src/monetize/store.js';
import { createWorld, stepWorld, revive, drainEvents } from '../src/sim/world.js';
import { loadSave, writeSave } from '../src/storage.js';

const LINES = ['....', '.BB.', '....'];

describe('reward offers', () => {
  const base = { adsAvailable: true, adsRemoved: false, revivesUsed: 0, goldEarned: 12, goldDoubled: false };

  it('offers a revive and double gold through a rewarded ad', () => {
    const o = rewardOffers(base);
    expect(o.revive).toBe('ad');
    expect(o.doubleGold).toBe('ad');
  });

  it('after buying "remove ads" the same rewards are free (no ad)', () => {
    const o = rewardOffers({ ...base, adsAvailable: false, adsRemoved: true });
    expect(o.revive).toBe('free');
    expect(o.doubleGold).toBe('free');
  });

  it('offers nothing where there are no ads and no purchase (the web build)', () => {
    const o = rewardOffers({ ...base, adsAvailable: false });
    expect(o.revive).toBeNull();
    expect(o.doubleGold).toBeNull();
  });

  it('one revive per attempt', () => {
    expect(REVIVES_PER_RUN).toBe(1);
    expect(rewardOffers({ ...base, revivesUsed: 1 }).revive).toBeNull();
  });

  it('double gold needs some gold, and only once', () => {
    expect(rewardOffers({ ...base, goldEarned: 0 }).doubleGold).toBeNull();
    expect(rewardOffers({ ...base, goldDoubled: true }).doubleGold).toBeNull();
  });
});

describe('revive', () => {
  it('brings a lost run back: one life, ball on the paddle, bricks kept', () => {
    const w = createWorld(LINES, { lives: 1 });
    w.state = 'over';
    w.lives = 0;
    w.stun = 1.2;
    w.shells = [{ x: 1, y: 1 }];
    const before = w.grid.remaining;
    expect(revive(w)).toBe(true);
    expect(w.state).toBe('ready');
    expect(w.lives).toBe(1);
    expect(w.stun).toBe(0);
    expect(w.shells).toEqual([]);
    expect(w.grid.remaining).toBe(before);
    expect(drainEvents(w).some((e) => e.t === 'revive')).toBe(true);
    stepWorld(w, 1 / 60); // keeps running
  });

  it('does nothing unless the run is over', () => {
    const w = createWorld(LINES, { lives: 3 });
    expect(revive(w)).toBe(false);
    expect(w.lives).toBe(3);
  });
});

describe('ad and store adapters', () => {
  it('the web build has neither ads nor purchases', async () => {
    const ads = createAds({ native: false });
    expect(ads.available()).toBe(false);
    expect(await ads.showRewarded('revive')).toBe(false);
    const store = createStore({ native: false });
    expect(store.available()).toBe(false);
    expect(await store.buy(PRODUCT_REMOVE_ADS)).toBe(false);
    expect(await store.restore()).toEqual([]);
  });

  it('the mock ad (dev builds) rewards after a short "ad"', async () => {
    const ads = createMockAds({ delayMs: 1 });
    expect(ads.available()).toBe(true);
    expect(await ads.showRewarded('revive')).toBe(true);
  });

  it('one ad at a time: a second request while one is showing is refused', async () => {
    const ads = createMockAds({ delayMs: 20 });
    const first = ads.showRewarded('revive');
    expect(await ads.showRewarded('doubleGold')).toBe(false);
    expect(await first).toBe(true);
  });
});

describe('remove-ads entitlement in the save', () => {
  function fakeStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
  beforeEach(() => { globalThis.localStorage = fakeStorage(); });

  it('defaults off and only an explicit true turns it on', () => {
    expect(loadSave().adsRemoved).toBe(false);
    writeSave({ ...loadSave(), adsRemoved: true });
    expect(loadSave().adsRemoved).toBe(true);
    localStorage.setItem('breaker3d.v1', JSON.stringify({ unlocked: 2, adsRemoved: 'yes' }));
    expect(loadSave().adsRemoved).toBe(false);
  });
});
