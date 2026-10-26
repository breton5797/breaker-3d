import { describe, it, expect } from 'vitest';
import { stageSlot, BOSS_EVERY } from '../src/sim/sequence.js';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, drainEvents } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import {
  updateBoss, collideBoss, damageBoss, BOSS_KINDS, PLATES, PHASE2, PHASE3, ATTACK_EVERY, WARN_TIME,
} from '../src/sim/boss.js';
import { CELL, COLS } from '../src/sim/constants.js';

/** Seeded random so movement and attacks are repeatable. */
function rng(seed = 3) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const bossWorld = (n = 9) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: rng() });
  return { level, w };
};
const inner = (box) => ({ left: box.left + 1, right: box.right - 1, bottom: box.bottom + 1, top: box.top - 1 });
const highestBrickRow = (w) => {
  for (let r = w.grid.box.top - 1; r > w.grid.box.bottom; r--) {
    for (let c = w.grid.box.left + 1; c < w.grid.box.right; c++) if (w.grid.cells[r * COLS + c] !== CELL.EMPTY) return r;
  }
  return w.grid.box.bottom;
};
/** Runs the boss alone (no balls) for `seconds`, collecting events. */
const run = (w, seconds, dt = 1 / 60) => {
  const ev = [];
  for (let t = 0; t < seconds; t += dt) { updateBoss(w, dt); ev.push(...drainEvents(w)); }
  return ev;
};

describe('stage order with bosses', () => {
  it('every 10th stage is a boss (stage 10, 20, 30 ...)', () => {
    expect(BOSS_EVERY).toBe(10);
    expect(stageSlot(9).boss).toBe(true);
    expect(stageSlot(19).boss).toBe(true);
    expect(stageSlot(8).boss).toBe(false);
    expect(stageSlot(10).boss).toBe(false);
  });

  it('bosses do not swallow regular maps: content runs on without gaps', () => {
    const contents = [];
    for (let n = 0; n < 40; n++) if (!stageSlot(n).boss) contents.push(stageSlot(n).content);
    expect(contents).toEqual([...Array(contents.length).keys()]);
  });

  it('the four bosses take turns', () => {
    expect([9, 19, 29, 39, 49].map((n) => getLevel(n).boss.kind)).toEqual([...BOSS_KINDS, BOSS_KINDS[0]]);
  });
});

describe('boss character', () => {
  it('a boss stage carries a living boss with armour plates, floating above the bricks', () => {
    const { level, w } = bossWorld();
    expect(level.name).toMatch(/^BOSS/);
    expect(w.boss.alive).toBe(true);
    expect(w.boss.phase).toBe(1);
    expect(w.boss.hp).toBe(level.boss.hp);
    expect(w.boss.plates).toHaveLength(PLATES);
    expect(w.boss.y - w.boss.r).toBeGreaterThan(highestBrickRow(w));
  });

  it('regular stages have no boss', () => {
    const level = getLevel(10);
    expect(level.boss).toBeNull();
    expect(createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss }).boss).toBeNull();
  });

  it('moves around, always inside the box and above the bricks', () => {
    for (const n of [9, 19, 29, 39]) {
      const { w } = bossWorld(n);
      w.state = 'play';
      const box = inner(w.grid.box);
      const floor = highestBrickRow(w);
      const xs = new Set();
      for (let t = 0; t < 20; t += 1 / 30) {
        updateBoss(w, 1 / 30);
        drainEvents(w);
        xs.add(Math.round(w.boss.x));
        expect(w.boss.x - w.boss.r).toBeGreaterThanOrEqual(box.left - 1e-6);
        expect(w.boss.x + w.boss.r).toBeLessThanOrEqual(box.right + 1 + 1e-6);
        expect(w.boss.y + w.boss.r).toBeLessThanOrEqual(box.top + 1 + 1e-6);
        expect(w.boss.y - w.boss.r).toBeGreaterThan(floor);
      }
      expect(xs.size).toBeGreaterThan(5); // it really travels
    }
  });

  it('a ball bounces off the body and deals one point of damage', () => {
    const { w } = bossWorld();
    w.state = 'play';
    w.boss.plates = []; // keep the plates out of this test
    const { x, y, r } = w.boss;
    addBall(w.balls, x, y - r - 0.2, 0, 40); // just under the body, flying up into it
    const hp = w.boss.hp;
    expect(collideBoss(w, 0)).toBe(true);
    expect(w.balls.vy[0]).toBeLessThan(0);
    expect(Math.hypot(w.balls.x[0] - x, w.balls.y[0] - y)).toBeGreaterThanOrEqual(r);
    expect(w.boss.hp).toBe(hp - 1);
    expect(drainEvents(w).some((e) => e.t === 'boss-hit')).toBe(true);
  });

  it('a ball moving away from the body is left alone', () => {
    const { w } = bossWorld();
    w.boss.plates = [];
    addBall(w.balls, w.boss.x, w.boss.y - w.boss.r - 0.2, 0, -40);
    expect(collideBoss(w, 0)).toBe(false);
  });

  it('armour plates block balls without taking damage', () => {
    const { w } = bossWorld();
    w.state = 'play';
    const p = w.boss.plates[0];
    const px = w.boss.x + Math.cos(p.angle) * w.boss.plateOrbit;
    const py = w.boss.y + Math.sin(p.angle) * w.boss.plateOrbit;
    // Come at the plate from outside, along the line through its centre.
    const ox = Math.cos(p.angle);
    const oy = Math.sin(p.angle);
    addBall(w.balls, px + ox * (w.boss.plateR + 0.2), py + oy * (w.boss.plateR + 0.2), -ox * 40, -oy * 40);
    const hp = w.boss.hp;
    expect(collideBoss(w, 0)).toBe(true);
    expect(w.boss.hp).toBe(hp);
    expect(w.balls.vx[0] * ox + w.balls.vy[0] * oy).toBeGreaterThan(0); // sent back outward
  });

  it('a swarm cannot melt it: damage per second is capped (the rest bounce off a shield)', () => {
    const { level, w } = bossWorld();
    w.state = 'play';
    const hp0 = w.boss.hp;
    for (let k = 0; k < 400; k++) damageBoss(w, 1);
    expect(hp0 - w.boss.hp).toBeLessThanOrEqual(level.boss.dps * 2);
    expect(drainEvents(w).some((e) => e.t === 'boss-shield')).toBe(true);
    run(w, 1);
    const before = w.boss.hp;
    damageBoss(w, 1);
    expect(w.boss.hp).toBe(before - 1);
  });

  it('grows angry at 60% (phase 2) and sheds its plates at 25% (phase 3)', () => {
    const { w } = bossWorld();
    w.state = 'play';
    w.boss.budget = Infinity;
    damageBoss(w, Math.ceil(w.boss.hpMax * (1 - PHASE2)));
    expect(w.boss.phase).toBe(2);
    expect(drainEvents(w).some((e) => e.t === 'boss-phase' && e.phase === 2)).toBe(true);
    damageBoss(w, Math.ceil(w.boss.hpMax * (PHASE2 - PHASE3)));
    expect(w.boss.phase).toBe(3);
    expect(w.boss.plates).toHaveLength(0);
  });

  it('at zero hit points the boss goes down, the arena shatters and the stage clears', () => {
    const { w } = bossWorld();
    w.state = 'play';
    w.boss.budget = Infinity;
    addBall(w.balls, 3, 3, 0, 40); // keep a ball alive so the run doesn't end
    damageBoss(w, w.boss.hp);
    expect(w.boss.alive).toBe(false);
    expect(w.finale).toBe(true);
    expect(drainEvents(w).some((e) => e.t === 'boss-down')).toBe(true);
    for (let t = 0; t < 12 && w.state === 'play'; t += 1 / 60) stepWorld(w, 1 / 60);
    expect(w.state).toBe('clear');
  });

  it('clearing every arena brick does not end the stage while the boss lives', () => {
    const { w } = bossWorld();
    w.state = 'play';
    addBall(w.balls, 3, 3, 0, 40);
    w.grid.remaining = 0; // the swarm smashed the whole arena
    stepWorld(w, 1 / 60);
    expect(w.state).toBe('play');
    w.boss.budget = Infinity;
    damageBoss(w, w.boss.hp);
    stepWorld(w, 1 / 60);
    expect(w.state).toBe('clear');
  });

  it('the usual "nearly done" finale waits until the boss is down', () => {
    const { w } = bossWorld();
    w.state = 'play';
    addBall(w.balls, 5, 5, 0, 30);
    w.grid.remaining = 3;
    stepWorld(w, 1 / 60);
    expect(w.finale).toBe(false);
  });
});

describe('boss attacks', () => {
  for (const n of [9, 19, 29, 39]) {
    it(`${BOSS_KINDS[[9, 19, 29, 39].indexOf(n)]}: warns first, then strikes; a paddle in the zone is stunned`, () => {
      const { w } = bossWorld(n);
      w.state = 'play';
      const ev = run(w, ATTACK_EVERY + 0.05);
      const warn = ev.find((e) => e.t === 'boss-warn');
      expect(warn).toBeTruthy();
      // Stand in the zone (the sweep crosses the whole row anyway).
      w.paddle = { ...w.paddle, x: Math.min(COLS - w.paddle.w / 2, Math.max(w.paddle.w / 2, warn.x)) };
      const after = run(w, WARN_TIME + 2);
      expect(after.some((e) => e.t === 'boss-strike')).toBe(true);
      expect(after.some((e) => e.t === 'paddle-hit')).toBe(true);
      expect(w.stun).toBeGreaterThan(0);
    });
  }

  it('a paddle that moved out of a lane attack is not hit', () => {
    const { w } = bossWorld(19); // kraken: slams one lane
    w.state = 'play';
    const warn = run(w, ATTACK_EVERY + 0.05).find((e) => e.t === 'boss-warn');
    const away = warn.x < COLS / 2 ? COLS - w.paddle.w / 2 : w.paddle.w / 2;
    w.paddle = { ...w.paddle, x: away };
    const after = run(w, WARN_TIME + 0.2);
    expect(after.some((e) => e.t === 'boss-strike')).toBe(true);
    expect(after.some((e) => e.t === 'paddle-hit')).toBe(false);
  });

  it('holds its attacks while the ball waits on the paddle', () => {
    const { w } = bossWorld();
    w.state = 'ready';
    expect(run(w, ATTACK_EVERY * 3).some((e) => e.t === 'boss-warn')).toBe(false);
  });

  it('attacks come faster when it is angry', () => {
    const calm = bossWorld().w;
    calm.state = 'play';
    const angry = bossWorld().w;
    angry.state = 'play';
    angry.boss.budget = Infinity;
    damageBoss(angry, Math.ceil(angry.boss.hpMax * (1 - PHASE3)));
    drainEvents(angry);
    const count = (w) => run(w, 30).filter((e) => e.t === 'boss-warn').length;
    expect(count(angry)).toBeGreaterThan(count(calm));
  });
});
