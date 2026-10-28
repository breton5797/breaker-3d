import { describe, it, expect } from 'vitest';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, drainEvents } from '../src/sim/world.js';
import { updateBoss, damageBoss, attacksFor, ATTACK_KINDS, WARN_TIME, COMBO_GAP, PHASE3, RAIN_REACH } from '../src/sim/boss.js';
import { MAP_BOSSES, mapBossSpec } from '../src/sim/mapBosses.js';
import { COLS } from '../src/sim/constants.js';

function rng(seed = 3) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const bossWorld = (n, seed) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: rng(seed) });
  w.state = 'play';
  return w;
};
const run = (w, seconds, dt = 1 / 60) => {
  const ev = [];
  for (let t = 0; t < seconds; t += dt) { updateBoss(w, dt); ev.push(...drainEvents(w)); }
  return ev;
};
const warns = (ev) => ev.filter((e) => e.t === 'boss-warn');
/** Runs until the next warning appears (so the strike has not landed yet) and returns it. */
const nextWarn = (w, dt = 1 / 60) => {
  for (let t = 0; t < 20; t += dt) {
    updateBoss(w, dt);
    const warn = warns(drainEvents(w))[0];
    if (warn) return warn;
  }
  return null;
};
/** Paddle centres (every half cell) that a warning's zones would hit. */
const hits = (w, warn) => {
  const xs = warn.xs ?? [warn.x];
  const half = w.paddle.w / 2;
  const out = [];
  for (let p = half; p <= COLS - half; p += 0.5) if (xs.some((x) => Math.abs(p - x) <= warn.w / 2 + half)) out.push(p);
  return out;
};

describe('boss attack variety', () => {
  it('every boss has two or three different attacks, its signature one first', () => {
    for (const [mapId, m] of Object.entries(MAP_BOSSES)) {
      const list = mapBossSpec(mapId, 20).attackKinds;
      expect(list[0], mapId).toBe(m.attack);
      expect(new Set(list).size, mapId).toBe(list.length);
      expect(list.length, mapId).toBeGreaterThanOrEqual(2);
      for (const k of list) expect(ATTACK_KINDS, mapId).toContain(k);
    }
    for (const kind of ['colossus', 'kraken', 'golem', 'mothership']) expect(attacksFor(kind).length).toBe(3);
  });

  it('takes turns through its attacks', () => {
    const w = bossWorld(9); // colossus: three attacks
    const kinds = warns(run(w, 40)).map((e) => e.kind);
    expect(new Set(kinds).size).toBe(3);
    expect(kinds[0]).toBe(attacksFor('colossus')[0]);
    expect(kinds[1]).not.toBe(kinds[0]);
  });

  it('rain drops on several spots at once, one under the paddle, and always leaves a safe place', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = bossWorld(9, seed);
      w.boss.attackKinds = ['rain'];
      const warn = warns(run(w, 6))[0];
      expect(warn.kind).toBe('rain');
      expect(warn.xs.length).toBeGreaterThanOrEqual(3);
      expect(warn.xs.some((x) => Math.abs(x - w.paddle.x) < 1e-9)).toBe(true);
      const span = COLS - w.paddle.w + 1;
      expect(hits(w, warn).length / 2, `seed ${seed}`).toBeLessThan(span - 8); // room to stand clear
    }
  });

  it('the dry place is always close enough to reach before the drops land (even from a wall)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const start of ['left', 'mid', 'right']) {
        const w = bossWorld(39, seed); // last big boss stage: five drops when it is enraged
        w.boss.attackKinds = ['rain'];
        w.boss.phase = 3;
        const half = w.paddle.w / 2;
        w.paddle = { ...w.paddle, x: start === 'left' ? half : start === 'right' ? COLS - half : COLS / 2 };
        const warn = nextWarn(w);
        const hit = new Set(hits(w, warn));
        let nearest = Infinity;
        for (let p = half; p <= COLS - half; p += 0.5) if (!hit.has(p)) nearest = Math.min(nearest, Math.abs(p - w.paddle.x));
        expect(nearest, `seed ${seed} ${start}`).toBeLessThanOrEqual(RAIN_REACH);
      }
    }
  });

  it('a paddle too wide for a dry place gets a single drop instead (never an unavoidable rain)', () => {
    const w = bossWorld(9, 2);
    w.boss.attackKinds = ['rain'];
    w.paddle = { ...w.paddle, w: 60, x: COLS / 2 };
    const warn = nextWarn(w);
    expect(warn.xs).toEqual([w.paddle.x]);
  });

  it('rain hits a paddle under any drop and spares one in the gap', () => {
    const w = bossWorld(9, 5);
    w.boss.attackKinds = ['rain'];
    const warn = nextWarn(w);
    const safe = [];
    for (let p = w.paddle.w / 2; p <= COLS - w.paddle.w / 2; p += 0.5) if (!hits(w, warn).includes(p)) safe.push(p);
    w.paddle = { ...w.paddle, x: safe[0] };
    const after = run(w, WARN_TIME + 0.1);
    expect(after.some((e) => e.t === 'boss-strike' && e.kind === 'rain')).toBe(true);
    expect(after.some((e) => e.t === 'paddle-hit')).toBe(false);
    const w2 = bossWorld(9, 5);
    w2.boss.attackKinds = ['rain'];
    nextWarn(w2);
    run(w2, WARN_TIME + 0.1);
    expect(w2.stun).toBeGreaterThan(0); // stayed put under the first drop
  });

  it('dive marks a lane at the paddle, then swoops down it from the boss', () => {
    const w = bossWorld(9);
    w.boss.attackKinds = ['dive'];
    const warn = nextWarn(w);
    expect(warn.kind).toBe('dive');
    expect(warn.x).toBeCloseTo(w.paddle.x);
    expect(warn.from).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    const strike = run(w, WARN_TIME + 0.1).find((e) => e.t === 'boss-strike');
    expect(strike.kind).toBe('dive');
    expect(strike.from).toBeTruthy();
    expect(w.stun).toBeGreaterThan(0);
  });

  it('in its last phase it chains a second attack right after the first (rage combo)', () => {
    const w = bossWorld(9);
    w.boss.budget = Infinity;
    damageBoss(w, Math.ceil(w.boss.hpMax * (1 - PHASE3)) + 1);
    w.boss.stun = 0;
    drainEvents(w);
    const ev = run(w, 20);
    const times = [];
    let t = 0;
    for (let i = 0; i < 20 * 60; i++) { updateBoss(w, 1 / 60); t += 1 / 60; if (drainEvents(w).some((e) => e.t === 'boss-warn')) times.push(t); }
    const gaps = times.slice(1).map((x, i) => x - times[i]);
    expect(ev.length).toBeGreaterThan(0);
    // Some gap is just the warning + the short combo pause; every warning still lasts WARN_TIME.
    expect(Math.min(...gaps)).toBeLessThan(WARN_TIME + COMBO_GAP + 1.5);
    expect(gaps.some((g) => g > WARN_TIME + COMBO_GAP + 1.5)).toBe(true); // and then a breather
  });

  it('a gentle early stage still never attacks', () => {
    const w = bossWorld(0);
    expect(warns(run(w, 30))).toEqual([]);
  });
});
