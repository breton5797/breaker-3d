import { describe, it, expect } from 'vitest';
import {
  spendGold, buyLoadout, takeLoadout, LOADOUT, recordStars, totalStars, claimChests, STARS_PER_CHEST, CHEST_GOLD,
  dailyBonus, DAILY_GOLD, recordBeaten, nextGoals, progressShare,
} from '../src/meta.js';
import { loadSave } from '../src/storage.js';
import { BOSS_KINDS } from '../src/sim/boss.js';
import { MAP_BOSSES } from '../src/sim/mapBosses.js';

const base = (more = {}) => ({ unlocked: 1, best: {}, gold: 0, achievements: [], stars: {}, chests: 0, daily: { last: '', streak: 0 }, loadout: { split: 0, meteor: 0 }, beaten: [], ...more });

describe('gold has somewhere to go', () => {
  it('spending takes gold away, never below zero', () => {
    expect(spendGold(base({ gold: 100 }), 40).gold).toBe(60);
    expect(spendGold(base({ gold: 30 }), 40)).toBeNull();
  });

  it('the loadout buys extra skill charges for the next stage, at most 2 each', () => {
    let s = base({ gold: 500 });
    s = buyLoadout(s, 'split');
    expect(s.gold).toBe(500 - LOADOUT.split.price);
    expect(s.loadout.split).toBe(1);
    s = buyLoadout(s, 'split');
    expect(s.loadout.split).toBe(LOADOUT.split.max);
    expect(buyLoadout(s, 'split')).toBeNull(); // full
    expect(buyLoadout(base({ gold: 10 }), 'meteor')).toBeNull(); // too poor
    expect(buyLoadout(base({ gold: 999 }), 'magnet')).toBeNull(); // no such thing
  });

  it('starting a stage uses the loadout up', () => {
    const s = buyLoadout(base({ gold: 500 }), 'meteor');
    const { save, extra } = takeLoadout(s);
    expect(extra).toEqual({ split: 0, meteor: 1 });
    expect(save.loadout).toEqual({ split: 0, meteor: 0 });
  });
});

describe('stars are kept and add up', () => {
  it('a stage keeps its best star count', () => {
    let s = recordStars(base(), 4, 2);
    s = recordStars(s, 4, 1);
    expect(s.stars[4]).toBe(2);
    s = recordStars(s, 4, 3);
    expect(s.stars[4]).toBe(3);
    expect(totalStars(recordStars(s, 0, 1))).toBe(4);
  });

  it(`every ${STARS_PER_CHEST} stars open a chest of ${CHEST_GOLD} gold, once each`, () => {
    const stars = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 3])); // 63 stars
    const first = claimChests(base({ stars }));
    expect(first.gold).toBe(2 * CHEST_GOLD);
    expect(first.save.chests).toBe(2);
    expect(first.save.gold).toBe(2 * CHEST_GOLD);
    expect(claimChests(first.save).gold).toBe(0);
  });
});

describe('a reason to come back tomorrow', () => {
  it('the first clear of a day pays, the second does not', () => {
    const a = dailyBonus(base(), '2026-10-28');
    expect(a.gold).toBe(DAILY_GOLD[0]);
    expect(a.save.daily).toEqual({ last: '2026-10-28', streak: 1 });
    expect(dailyBonus(a.save, '2026-10-28').gold).toBe(0);
  });

  it('coming back the next day grows the streak (and the pay); a gap starts over', () => {
    let s = dailyBonus(base(), '2026-10-28').save;
    const d2 = dailyBonus(s, '2026-10-29');
    expect(d2.save.daily.streak).toBe(2);
    expect(d2.gold).toBe(DAILY_GOLD[1]);
    s = d2.save;
    expect(dailyBonus(s, '2026-11-02').save.daily.streak).toBe(1);
  });

  it('month and year ends count as the next day', () => {
    const s = dailyBonus(base(), '2026-12-31').save;
    expect(dailyBonus(s, '2027-01-01').save.daily.streak).toBe(2);
  });

  it('the pay stops rising after a week', () => {
    let s = base();
    let gold = 0;
    for (let d = 1; d <= 10; d++) {
      const r = dailyBonus(s, `2026-11-${String(d).padStart(2, '0')}`);
      s = r.save;
      gold = r.gold;
    }
    expect(s.daily.streak).toBe(10);
    expect(gold).toBe(DAILY_GOLD[DAILY_GOLD.length - 1]);
  });

  it('a clock set back pays nothing and breaks nothing', () => {
    const s = dailyBonus(base(), '2026-10-28').save;
    const back = dailyBonus(s, '2026-10-20');
    expect(back.gold).toBe(0);
    expect(back.save.daily).toEqual(s.daily);
  });
});

describe('bosses beaten and goals', () => {
  it('remembers each boss kind once', () => {
    const s = recordBeaten(recordBeaten(base(), 'mummy'), 'mummy');
    expect(s.beaten).toEqual(['mummy']);
  });

  it('the title can say how far the next big boss and the next chapter are', () => {
    const g = nextGoals(4); // stage 5 is next
    expect(g.toBoss).toBe(5); // stage 10
    expect(nextGoals(9).toBoss).toBe(0); // the next stage IS the boss
  });

  it('a lost run reports how much of the mural was broken', () => {
    expect(progressShare({ total: 400, remaining: 100 })).toBe(75);
    expect(progressShare({ total: 0, remaining: 0 })).toBe(0);
  });
});

describe('save data for all of this is validated', () => {
  const load = (raw) => {
    const store = new Map([['breaker3d.v1', JSON.stringify(raw)]]);
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: () => {} };
    return loadSave();
  };

  it('an old save (none of the new fields) loads with safe defaults', () => {
    const s = load({ unlocked: 7, best: { 3: 900 }, gold: 50 });
    expect(s.stars).toEqual({});
    expect(s.chests).toBe(0);
    expect(s.daily).toEqual({ last: '', streak: 0 });
    expect(s.loadout).toEqual({ split: 0, meteor: 0 });
    expect(s.beaten).toEqual([]);
  });

  it('tampered values are clamped or dropped', () => {
    const s = load({
      unlocked: 3,
      stars: { 1: 3, 2: 9, x: 2, 4: -1, 5: 2.5 },
      chests: -4,
      daily: { last: '<script>', streak: 1e9 },
      loadout: { split: 99, meteor: 'lots' },
      beaten: ['mummy', 'mummy', 'nope!', 42, 'colossus'],
    });
    expect(s.stars).toEqual({ 1: 3 });
    expect(s.chests).toBe(0);
    expect(s.daily).toEqual({ last: '', streak: 0 });
    expect(s.loadout).toEqual({ split: LOADOUT.split.max, meteor: 0 });
    expect(s.beaten).toEqual(['mummy', 'colossus']);
  });

  it('only known boss kinds are kept', () => {
    const known = [...new Set([...BOSS_KINDS, ...Object.values(MAP_BOSSES).map((b) => b.kind)])]; // 놀이 세계 reuses earlier bosses
    const s = load({ beaten: [...known, 'madeUp'] });
    expect(s.beaten).toEqual(known);
  });
});
