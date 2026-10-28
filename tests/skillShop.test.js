import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buyInPlay, skillPrice, SKILL_PRICES, SKILL_USES } from '../src/meta.js';

const save = (gold) => ({ gold, loadout: { split: 0, meteor: 0 } });
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('skills are bought with coins during a stage', () => {
  it('split comes as x2, x3, x4 or x5, each dearer than the last; meteor has one price', () => {
    expect(Object.keys(SKILL_PRICES.split).map(Number)).toEqual([2, 3, 4, 5]);
    const prices = [2, 3, 4, 5].map((m) => skillPrice('split', m));
    for (let k = 1; k < prices.length; k++) expect(prices[k]).toBeGreaterThan(prices[k - 1]);
    expect(skillPrice('meteor')).toBeGreaterThan(0);
    expect(skillPrice('split', 7)).toBeUndefined();
    expect(skillPrice('magnet')).toBeUndefined();
  });

  it('spends the coins picked up this stage first, then the banked coins', () => {
    const r = buyInPlay(save(100), 25, 'split', 0, 4);
    expect(r.ok).toBe(true);
    expect(r.live).toBe(0);
    expect(r.save.gold).toBe(100 - (skillPrice('split', 4) - 25));
    const s = buyInPlay(save(0), 70, 'meteor', 0);
    expect(s.ok).toBe(true);
    expect(s.live).toBe(70 - skillPrice('meteor'));
    expect(s.save.gold).toBe(0);
  });

  it('refuses when the coins are short, leaving everything as it was', () => {
    const before = save(10);
    const r = buyInPlay(before, 5, 'split', 0, 5);
    expect(r.ok).toBe(false);
    expect(r.save).toBe(before);
    expect(r.live).toBe(5);
  });

  it(`each skill can be used ${SKILL_USES} times per stage at most`, () => {
    expect(SKILL_USES).toBe(2);
    expect(buyInPlay(save(999), 0, 'split', SKILL_USES, 2).ok).toBe(false);
    expect(buyInPlay(save(999), 0, 'meteor', SKILL_USES - 1).ok).toBe(true);
    expect(buyInPlay(save(999), 0, 'split', 0, 9).ok).toBe(false);
  });

  it('never charges coins for a skill that cannot fire now (e.g. a split before the serve)', () => {
    const main = read('src/main.js');
    const body = main.slice(main.indexOf('function buySkill('), main.indexOf('function trySkill('));
    expect(body.indexOf('if (!canFire(kind))')).toBeGreaterThan(-1);
    expect(body.indexOf('if (!canFire(kind))')).toBeLessThan(body.indexOf('buyInPlay('));
  });

  it('stages start with no free charges; the split button opens a picker of multipliers', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/charges: \{ split: 0, meteor: 0 \}/);
    const html = read('index.html');
    for (const m of [2, 3, 4, 5]) expect(html).toContain(`id="pick-split-${m}"`);
    expect(html).not.toContain('btn-buy-split');
  });
});

describe('cleaner board', () => {
  it('a ball knocking on steel makes a tink but leaves no lingering shards', () => {
    const director = read('src/director.js');
    const wall = director.slice(director.indexOf("case 'wall':"), director.indexOf('break;', director.indexOf("case 'wall':")));
    expect(wall).toMatch(/audio\.wallKnock\(/);
    expect(wall).not.toMatch(/fx\.shards/);
  });

  it('boss cards have no panel behind the boss: only the picture and its name', () => {
    const css = read('src/style.css');
    const rule = css.match(/\.boss-card \{[^}]*\}/)[0];
    expect(rule).toMatch(/background: none/);
    expect(rule).toMatch(/border: none/);
  });
});
