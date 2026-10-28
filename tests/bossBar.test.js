import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, drainEvents } from '../src/sim/world.js';
import { damageBoss, updateBoss, GUARD_FLOOR, PRE_FINALE_PACE } from '../src/sim/boss.js';

const bossWorld = (n = 12) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: () => 0.5 });
  w.state = 'play';
  return w;
};

describe('boss health bar', () => {
  it('a bigger protected share (30%) stays until the bricks are (nearly) all broken', () => {
    expect(GUARD_FLOOR).toBe(0.3);
    const w = bossWorld();
    w.boss.budget = Infinity;
    damageBoss(w, w.boss.hpMax * 5);
    expect(w.boss.hp).toBeCloseTo(w.boss.hpMax * GUARD_FLOOR);
    expect(w.boss.alive).toBe(true);
  });

  it('hits that cannot lower it report no damage (no endless "-N" numbers) and give no score', () => {
    const w = bossWorld();
    w.boss.budget = Infinity;
    damageBoss(w, w.boss.hpMax * 5);
    drainEvents(w);
    const score = w.score;
    damageBoss(w, 3);
    const hit = drainEvents(w).find((e) => e.t === 'boss-hit');
    expect(hit?.dmg ?? 0).toBe(0);
    expect(w.score).toBe(score);
  });

  it('before the finale it takes damage at a slower pace, so the bar drains along with the bricks', () => {
    expect(PRE_FINALE_PACE).toBeLessThan(1);
    const w = bossWorld();
    w.boss.budget = 0;
    updateBoss(w, 0.5);
    expect(w.boss.budget).toBeCloseTo(w.boss.dps * PRE_FINALE_PACE * 0.5, 5);
    const v = bossWorld();
    v.finale = true;
    v.boss.budget = 0;
    updateBoss(v, 0.5);
    expect(v.boss.budget).toBeCloseTo(v.boss.dps * 0.5, 5);
  });

  it('a blow on the protected part only flashes the bar (no flinch, no tink, no number)', () => {
    const src = readFileSync(new URL('../src/director.js', import.meta.url), 'utf8');
    expect(src).toMatch(/case 'boss-hit':\s*\/\/[^\n]*\n\s*if \(\(e\.dmg \?\? 1\) <= 0\) \{ ui\.bossShield\(\); break; \}/);
  });

  it('the bar shows the protected part in blue-green on the right from the start', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="boss-guard"');
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/#boss-guard\s*\{[^}]*background/);
    const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
    expect(ui).toMatch(/function setBoss\(name, share = 1, guard = 0\)/);
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toMatch(/ui\.setBoss\([^)]*GUARD_FLOOR/);
  });
});
