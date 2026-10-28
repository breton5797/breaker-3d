import { describe, it, expect } from 'vitest';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, drainEvents, launch } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { damageBoss, GUARD_FLOOR } from '../src/sim/boss.js';
import { mapBossSpec } from '../src/sim/mapBosses.js';
import { FINALE_FRACTION } from '../src/sim/constants.js';
import { CELL } from '../src/sim/constants.js';

function rng(seed = 11) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const fight = (n = 0) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: rng() });
  launch(w);
  w.boss.budget = Infinity;
  return w;
};
/** Breaks bricks (straight off the grid) until only `left` remain. */
function clearDownTo(w, left) {
  const g = w.grid;
  for (let i = 0; i < g.cells.length && g.remaining > left; i++) {
    if (g.cells[i] !== CELL.EMPTY && g.cells[i] !== CELL.STEEL) { g.cells[i] = CELL.EMPTY; g.remaining--; }
  }
}

describe('bricks come first: the boss cannot fall while the mural stands', () => {
  it('while bricks remain, the boss bottoms out at its guard floor instead of dying', () => {
    const w = fight();
    damageBoss(w, w.boss.hpMax * 5);
    expect(w.boss.alive).toBe(true);
    expect(w.boss.hp).toBeCloseTo(Math.max(1, w.boss.hpMax * GUARD_FLOOR));
    expect(w.finale).toBeFalsy();
  });

  it('says so once, the first time a blow is held back', () => {
    const w = fight();
    damageBoss(w, w.boss.hpMax * 5);
    damageBoss(w, 5);
    damageBoss(w, 5);
    expect(drainEvents(w).filter((e) => e.t === 'boss-guard')).toHaveLength(1);
  });

  it('when the mural is nearly gone, the last bricks shatter first and the boss opens up', () => {
    const w = fight();
    clearDownTo(w, Math.floor(w.grid.total * FINALE_FRACTION));
    stepWorld(w, 1 / 60);
    const ev = drainEvents(w);
    expect(w.finale).toBe(true);
    expect(w.boss.alive).toBe(true);
    expect(ev.some((e) => e.t === 'boss-open')).toBe(true);
    w.boss.budget = Infinity; // stepping refilled it to its usual cap
    damageBoss(w, w.boss.hpMax * 5);
    expect(w.boss.alive).toBe(false);
  });

  it('beating it after the finale does not start a second one, and the stage clears', () => {
    const w = fight();
    clearDownTo(w, Math.floor(w.grid.total * FINALE_FRACTION));
    stepWorld(w, 1 / 60);
    const zaps = w.pending.length;
    drainEvents(w);
    addBall(w.balls, 3, 3, 0, 40); // keep a ball alive so the run doesn't end
    w.boss.budget = Infinity;
    damageBoss(w, w.boss.hpMax * 5);
    expect(drainEvents(w).filter((e) => e.t === 'finale')).toHaveLength(0);
    expect(w.pending.length).toBeLessThanOrEqual(zaps);
    for (let t = 0; t < 8 && w.state !== 'clear'; t += 1 / 60) stepWorld(w, 1 / 60);
    expect(w.state).toBe('clear');
  });

  it('big bosses (every 10th stage) follow the same rule', () => {
    const w = fight(9);
    damageBoss(w, w.boss.hpMax * 5);
    expect(w.boss.alive).toBe(true);
  });
});

describe('map boss health follows the size of the mural', () => {
  it('more bricks, more health', () => {
    expect(mapBossSpec('giza', 0, 4000).hp).toBeGreaterThan(mapBossSpec('giza', 0, 1500).hp);
  });

  it('is above the old formula (50 + 0.8 per stage) for a normal mural', () => {
    expect(mapBossSpec('giza', 0, 3000).hp).toBeGreaterThanOrEqual(80);
  });

  it('getLevel passes the stage brick count through', () => {
    expect(getLevel(0).boss.hp).toBe(mapBossSpec('giza', 0, getLevel(0).bricks).hp);
  });
});
