import { describe, it, expect, vi } from 'vitest';
import { createEventClaims } from '../src/eventsClaim.js';
import { track, dailyMissions } from '../src/events.js';

// Claims from the events panel, with the rewarded-ad double (owner, 2026-11-19).
// AD_MONETIZATION 5: pay on the SDK's earned-reward result only, never twice, never when the ad fails.
const DAY = '2026-11-18';
const m = dailyMissions(DAY, 30)[0];
const ready = () => track({ unlocked: 30, gold: 0 }, DAY, { [m.metric]: m.goal });

function setup({ via = 'ad', earned = true } = {}) {
  let save = ready();
  let release;
  const watchAd = vi.fn(() => new Promise((ok) => { release = () => ok(earned); }));
  const commit = vi.fn((s) => { save = s; });
  const toast = vi.fn();
  const claim = createEventClaims({ getSave: () => save, commit, via: () => via, watchAd, toast, today: () => DAY });
  return { claim, watchAd, commit, toast, gold: () => save.gold, finishAd: () => release() };
}

describe('event claims', () => {
  it('a normal claim pays once, no ad', async () => {
    const s = setup();
    await s.claim('mission', 0, false);
    await s.claim('mission', 0, false);
    expect(s.gold()).toBe(m.gold);
    expect(s.commit).toHaveBeenCalledOnce();
    expect(s.watchAd).not.toHaveBeenCalled();
  });

  it('a double plays the ad and pays twice the gold only after it was earned', async () => {
    const s = setup();
    const p = s.claim('mission', 0, true);
    expect(s.gold()).toBe(0); // nothing before the reward
    s.finishAd();
    await p;
    expect(s.watchAd).toHaveBeenCalledWith('missionDouble');
    expect(s.gold()).toBe(m.gold * 2);
  });

  it('a failed or skipped ad pays nothing and says so; the normal claim still works', async () => {
    const s = setup({ earned: false });
    const p = s.claim('mission', 0, true);
    s.finishAd();
    await p;
    expect(s.gold()).toBe(0);
    expect(s.toast).toHaveBeenCalledWith('failed');
    await s.claim('mission', 0, false);
    expect(s.gold()).toBe(m.gold);
  });

  it('taps while the ad is on screen are ignored (no second ad, no second payout)', async () => {
    const s = setup();
    const p = s.claim('mission', 0, true);
    await s.claim('mission', 0, true);
    await s.claim('mission', 0, false);
    s.finishAd();
    await p;
    expect(s.watchAd).toHaveBeenCalledOnce();
    expect(s.gold()).toBe(m.gold * 2);
  });

  it('after "remove ads" the double needs no ad; with no ads at all there is no double', async () => {
    const free = setup({ via: 'free' });
    await free.claim('mission', 0, true);
    expect(free.watchAd).not.toHaveBeenCalled();
    expect(free.gold()).toBe(m.gold * 2);
    const none = setup({ via: null });
    await none.claim('mission', 0, true);
    expect(none.gold()).toBe(0);
  });
});
