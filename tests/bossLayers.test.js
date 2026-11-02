import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bossBarFill, BLUE_FROM } from '../src/bossLayers.js';
import { GUARD_FLOOR } from '../src/sim/boss.js';
import { getLevel } from '../src/sim/levels.js';
import { stageSlot } from '../src/sim/sequence.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('boss energy bar: one green-blue-red gradient that drains from the green end (owner, 2026-11-02)', () => {
  it('starts full, showing all three colours', () => {
    const f = bossBarFill(1, GUARD_FLOOR);
    expect(f.width).toBe(1);
    expect(f.size).toBe(1);
  });

  it('the colours keep their place on the bar as it shrinks (green goes first, red last)', () => {
    const f = bossBarFill(0.5, GUARD_FLOOR);
    expect(f.width).toBeCloseTo(0.5, 5);
    expect(f.size).toBeCloseTo(2, 5); // the gradient stays full-bar wide, so only its green end is cut off
    expect(bossBarFill(0, GUARD_FLOOR).width).toBe(0);
    expect(Number.isFinite(bossBarFill(0, GUARD_FLOOR).size)).toBe(true);
  });

  it('each colour covers its share of health: green down to BLUE_FROM, blue down to the protected red part', () => {
    const f = bossBarFill(1, GUARD_FLOOR);
    expect(f.greenEnd).toBeCloseTo(1 - BLUE_FROM, 5);
    expect(f.redStart).toBeCloseTo(1 - GUARD_FLOOR, 5);
    expect(BLUE_FROM).toBeGreaterThan(GUARD_FLOOR);
    expect(BLUE_FROM).toBeLessThan(1);
  });

  it('the bar is drawn as one gradient (green, blue, red) and says the red part is the protected one', () => {
    const css = read('../src/style.css');
    expect(css).toMatch(/#boss-fill \{[^}]*linear-gradient\(90deg,[^}]*var\(--green-end\)[^}]*var\(--red-start\)/);
    expect(css).not.toMatch(/data-under|data-color/);
    expect(read('../src/ui.js')).toMatch(/bossBarFill\(share, guard\)/);
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
