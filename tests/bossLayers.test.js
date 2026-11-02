import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bossBarLayer, BLUE_FROM } from '../src/bossLayers.js';
import { GUARD_FLOOR } from '../src/sim/boss.js';
import { getLevel } from '../src/sim/levels.js';
import { stageSlot } from '../src/sim/sequence.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('boss energy bar: green, then blue, then red (owner, 2026-11-02)', () => {
  it('starts full green with blue waiting underneath', () => {
    expect(bossBarLayer(1, GUARD_FLOOR)).toEqual({ color: 'green', width: 1, under: 'blue' });
  });

  it('green drains first, then a full blue bar, then red (the protected last part)', () => {
    const g = bossBarLayer((1 + BLUE_FROM) / 2, GUARD_FLOOR);
    expect(g.color).toBe('green');
    expect(g.width).toBeCloseTo(0.5, 5);
    expect(bossBarLayer(BLUE_FROM, GUARD_FLOOR)).toEqual({ color: 'blue', width: 1, under: 'red' });
    const b = bossBarLayer((BLUE_FROM + GUARD_FLOOR) / 2, GUARD_FLOOR);
    expect(b.color).toBe('blue');
    expect(b.width).toBeCloseTo(0.5, 5);
    expect(bossBarLayer(GUARD_FLOOR, GUARD_FLOOR)).toEqual({ color: 'red', width: 1, under: null });
    expect(bossBarLayer(GUARD_FLOOR / 2, GUARD_FLOOR).width).toBeCloseTo(0.5, 5);
    expect(bossBarLayer(0, GUARD_FLOOR)).toEqual({ color: 'red', width: 0, under: null });
  });

  it('the blue part sits between the green and the red one', () => {
    expect(BLUE_FROM).toBeGreaterThan(GUARD_FLOOR);
    expect(BLUE_FROM).toBeLessThan(1);
  });

  it('the bar paints the three colours and says the red part is the protected one', () => {
    const css = read('../src/style.css');
    for (const c of ['green', 'blue', 'red']) expect(css).toMatch(new RegExp(`#boss-bar \\.boss-hp\\[data-under="${c}"\\]|#boss-fill\\[data-color="${c}"\\]`));
    expect(read('../src/locales/ko.js')).toMatch(/'boss\.guardTitle': '빨간/);
  });
});

describe('boss name and bar stay at the top, away from the paddle (owner, 2026-11-02)', () => {
  it('the bar never moves down to the lane by the paddle', () => {
    const ui = read('../src/ui.js');
    expect(ui).not.toMatch(/paddleTop - barH/);
    expect(read('../src/style.css')).not.toMatch(/#boss-bar\.lane/);
  });

  it('the boss intro card shows in the upper part of the screen', () => {
    const top = read('../src/style.css').match(/\.boss-card \{[^}]*top: (\d+)%/);
    expect(Number(top[1])).toBeLessThanOrEqual(32);
  });
});

describe('boss health rises with the stage (owner, 2026-11-02)', () => {
  const stages = Array.from({ length: 240 }, (_, n) => n);
  it('a map boss never has less health than the one on an earlier stage', () => {
    const hp = stages.filter((n) => !stageSlot(n).boss).map((n) => getLevel(n).boss.hp);
    for (let k = 1; k < hp.length; k++) expect(hp[k]).toBeGreaterThan(hp[k - 1]);
  });

  it('every big boss is tougher than the one before', () => {
    const hp = stages.filter((n) => stageSlot(n).boss).map((n) => getLevel(n).boss.hp);
    expect(hp.length).toBeGreaterThan(5);
    for (let k = 1; k < hp.length; k++) expect(hp[k]).toBeGreaterThan(hp[k - 1]);
  });
});
