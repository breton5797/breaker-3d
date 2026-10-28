import { describe, it, expect } from 'vitest';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, drainEvents } from '../src/sim/world.js';
import { updateBoss, damageBoss, PHASE3, STUN_TIME } from '../src/sim/boss.js';

function rng(seed = 7) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
/** A boss fight in play, with an endless damage budget so tests can deal exact amounts. */
const fight = (n = 9) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: rng() });
  w.state = 'play';
  w.boss.budget = Infinity;
  w.boss.dps = 1e9;
  w.finale = true; // the armour only breaks once the bricks are down (GUARD_FLOOR holds it until then)
  return w;
};
/** Knocks the boss just past the armour-break threshold. */
const breakArmour = (w) => damageBoss(w, Math.ceil(w.boss.hpMax * (1 - PHASE3)) + 1 - (w.boss.hpMax - w.boss.hp));

describe('armour break stuns the boss', () => {
  it('breaking the armour stuns it for STUN_TIME and says so', () => {
    const w = fight();
    breakArmour(w);
    const ev = drainEvents(w);
    expect(w.boss.phase).toBe(3);
    expect(w.boss.stun).toBeCloseTo(STUN_TIME);
    const stun = ev.find((e) => e.t === 'boss-stun');
    expect(stun).toBeTruthy();
    expect(stun.dur).toBe(STUN_TIME);
    expect(stun.plates).toBeGreaterThan(0); // how many plates flew off (render sends them flying)
  });

  it('a stunned boss stays put and calls off its attack', () => {
    const w = fight();
    w.boss.attack = { kind: 'stomp', stage: 'warn', t: 0.5, x: 10, w: 5, dir: 0, hit: false, beam: 10 };
    breakArmour(w);
    const { x, y } = w.boss;
    const ev = [];
    for (let t = 0; t < STUN_TIME - 0.1; t += 1 / 60) { updateBoss(w, 1 / 60); ev.push(...drainEvents(w)); }
    expect(w.boss.attack).toBeNull();
    expect(ev.filter((e) => e.t === 'boss-warn' || e.t === 'boss-strike')).toHaveLength(0);
    expect(Math.hypot(w.boss.x - x, w.boss.y - y)).toBeLessThan(0.5);
  });

  it('it takes double damage while stunned', () => {
    const w = fight();
    breakArmour(w);
    const before = w.boss.hp;
    damageBoss(w, 1);
    expect(before - w.boss.hp).toBe(2);
  });

  it('it wakes up after STUN_TIME, moves again and says so', () => {
    const w = fight();
    breakArmour(w);
    drainEvents(w);
    const ev = [];
    for (let t = 0; t < STUN_TIME + 0.2; t += 1 / 60) { updateBoss(w, 1 / 60); ev.push(...drainEvents(w)); }
    expect(w.boss.stun).toBe(0);
    expect(ev.some((e) => e.t === 'boss-wake')).toBe(true);
    const { x } = w.boss;
    for (let t = 0; t < 1; t += 1 / 60) updateBoss(w, 1 / 60);
    expect(Math.abs(w.boss.x - x)).toBeGreaterThan(0.2);
  });

  it('it is stunned only once per fight', () => {
    const w = fight();
    breakArmour(w);
    for (let t = 0; t < STUN_TIME + 0.2; t += 1 / 60) updateBoss(w, 1 / 60);
    drainEvents(w);
    damageBoss(w, 1);
    expect(drainEvents(w).some((e) => e.t === 'boss-stun')).toBe(false);
  });

  it('map bosses (fewer plates) are stunned the same way', () => {
    const w = fight(0);
    breakArmour(w);
    expect(w.boss.stun).toBeCloseTo(STUN_TIME);
  });

  it('hits report the damage dealt, so it can float up as a number', () => {
    const w = fight();
    damageBoss(w, 1);
    expect(drainEvents(w).find((e) => e.t === 'boss-hit').dmg).toBe(1);
    breakArmour(w);
    drainEvents(w);
    damageBoss(w, 1);
    expect(drainEvents(w).find((e) => e.t === 'boss-hit').dmg).toBe(2);
  });
});
