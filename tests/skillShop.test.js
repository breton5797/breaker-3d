import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buyInPlay, LOADOUT, IN_PLAY_MAX } from '../src/meta.js';

const save = (gold) => ({ gold, loadout: { split: 0, meteor: 0 } });
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('buying skill charges with gold during a stage', () => {
  it('spends the gold picked up this stage first, then the banked gold', () => {
    const r = buyInPlay(save(100), 25, 'split', 0);
    expect(r.ok).toBe(true);
    expect(r.live).toBe(0);
    expect(r.save.gold).toBe(100 - (LOADOUT.split.price - 25));
    const s = buyInPlay(save(0), 70, 'meteor', 0);
    expect(s.ok).toBe(true);
    expect(s.live).toBe(70 - LOADOUT.meteor.price);
    expect(s.save.gold).toBe(0);
  });

  it('refuses when the gold is short, leaving everything as it was', () => {
    const before = save(10);
    const r = buyInPlay(before, 5, 'meteor', 0);
    expect(r.ok).toBe(false);
    expect(r.save).toBe(before);
    expect(r.live).toBe(5);
  });

  it(`allows ${IN_PLAY_MAX} buys of each skill per stage at most`, () => {
    expect(buyInPlay(save(999), 0, 'split', IN_PLAY_MAX).ok).toBe(false);
    expect(buyInPlay(save(999), 0, 'split', IN_PLAY_MAX - 1).ok).toBe(true);
    expect(buyInPlay(save(999), 0, 'nope', 0).ok).toBe(false);
  });

  it('an empty skill button shows its price and buys on a tap', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/buyInPlay\(/);
    const ui = read('src/ui.js');
    expect(ui).toMatch(/s\.prices/);
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
