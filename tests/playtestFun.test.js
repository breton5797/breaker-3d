import { describe, it, expect } from 'vitest';
import { getLevel, stageParams } from '../src/sim/levels.js';
import { stageSlot } from '../src/sim/sequence.js';
import { createWorld, stepWorld, drainEvents, launch } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { multiplyBalls, updateDrops } from '../src/sim/items.js';
import { mapBossSpec } from '../src/sim/mapBosses.js';
import { STUN_SHRINK, PADDLE_Y, PADDLE_H, BALL_R, PRE_ENTRY_MAX, BEAM_SHARE, LAUNCH_BALLS } from '../src/sim/constants.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2; // as the sim computes it
import { isInside } from '../src/sim/box.js';

function rng(seed = 21) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const world = (n) => {
  const lvl = getLevel(n);
  return createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, boss: lvl.boss, rng: rng() });
};
/** A point well inside the box interior, clear of the walls. */
function insidePoint(w) {
  const { box } = w.grid;
  for (let y = box.bottom + 2; y < box.top - 2; y++) {
    for (let x = box.left + 2; x < box.right - 2; x++) if (isInside(w.grid, x + 0.5, y + 0.5)) return { x: x + 0.5, y: y + 0.5 };
  }
  throw new Error('no inside point');
}

describe('level fixes', () => {
  it('big boss stages never put an entrance in the ceiling (it sits under the boss, 0% entry)', () => {
    for (let n = 9; n < 400; n += 10) {
      expect(stageSlot(n).boss).toBe(true);
      expect(getLevel(n).holes.every((h) => h.side !== 'top'), `stage ${n + 1}`).toBe(true);
    }
  });

  it('tier-10 units arrive later (stage 195, not 177) and at most 10 units lie in wait', () => {
    expect(stageParams(193).unitTop).toBeLessThan(10);
    expect(stageParams(194).unitTop).toBe(10);
    for (let n = 0; n < 400; n += 7) expect(stageParams(n).unitCount).toBeLessThanOrEqual(10);
  });

  it('a stunned paddle shrinks less (0.75 of its width)', () => {
    expect(STUN_SHRINK).toBe(0.75);
  });

  it('map bosses can take more damage per second (shorter boss-only tail)', () => {
    expect(mapBossSpec('giza', 0, 3000).dps).toBeGreaterThanOrEqual(6);
  });
});

describe('the opening: getting in', () => {
  it('the first ball into the box after a serve raises an "enter" event, once', () => {
    const w = world(0);
    launch(w);
    drainEvents(w);
    const p = insidePoint(w);
    addBall(w.balls, p.x, p.y, 0, 20);
    stepWorld(w, 1 / 60);
    stepWorld(w, 1 / 60);
    expect(drainEvents(w).filter((e) => e.t === 'enter')).toHaveLength(1);
  });

  it('until a ball gets in, every paddle bounce adds a ball (up to PRE_ENTRY_MAX)', () => {
    const w = world(0);
    launch(w);
    const before = w.balls.n;
    // A ball falling onto the middle of the paddle.
    addBall(w.balls, w.paddle.x, PADDLE_TOP + BALL_R + 0.2, 0, -30);
    for (let k = 0; k < 3; k++) stepWorld(w, 1 / 120);
    expect(w.balls.n).toBe(before + 2);
    expect(PRE_ENTRY_MAX).toBeGreaterThanOrEqual(6);
  });

  it('once a ball is inside, paddle bounces add nothing', () => {
    const w = world(0);
    launch(w);
    const p = insidePoint(w);
    addBall(w.balls, p.x, p.y, 0, 20);
    stepWorld(w, 1 / 60);
    const before = w.balls.n;
    addBall(w.balls, w.paddle.x, PADDLE_TOP + BALL_R + 0.2, 0, -30);
    for (let k = 0; k < 3; k++) stepWorld(w, 1 / 120);
    expect(w.balls.n).toBe(before + 1);
  });

  it('the assist stops adding once the serve has PRE_ENTRY_MAX balls', () => {
    const w = world(0);
    launch(w);
    let assisted = 0;
    for (let k = 0; k < 20; k++) {
      const before = w.balls.n;
      addBall(w.balls, w.paddle.x, PADDLE_TOP + BALL_R + 0.2, 0, -30);
      for (let j = 0; j < 3; j++) stepWorld(w, 1 / 120);
      assisted += Math.max(0, w.balls.n - before - 1);
    }
    expect(assisted).toBeGreaterThan(0);
    expect(assisted).toBeLessThanOrEqual(PRE_ENTRY_MAX - LAUNCH_BALLS);
  });
});

describe('fruit after the shield is down: a beam at the boss', () => {
  /** A fruit right over the paddle, about to be caught. */
  const dropFruit = (w, mult = 10) => { w.drops = [{ x: w.paddle.x, y: PADDLE_TOP + 0.3, mult }]; };

  it('while the mural stands, catching fruit does not touch the boss', () => {
    const w = world(0);
    launch(w);
    const hp = w.boss.hp;
    dropFruit(w);
    updateDrops(w, 1 / 60);
    expect(w.boss.hp).toBe(hp);
    expect(drainEvents(w).some((e) => e.t === 'boss-beam')).toBe(false);
  });

  it('after the finale, a caught fruit fires a beam that hurts the boss past its damage cap', () => {
    const w = world(0);
    launch(w);
    w.finale = true;
    w.boss.budget = 0; // the swarm already spent this second's damage
    const hp = w.boss.hp;
    dropFruit(w, 10);
    updateDrops(w, 1 / 60);
    const ev = drainEvents(w);
    const beam = ev.find((e) => e.t === 'boss-beam');
    const { gain } = ev.find((e) => e.t === 'collect');
    expect(beam).toBeTruthy();
    expect(beam.dmg).toBeGreaterThan(0);
    expect(w.boss.hp).toBeCloseTo(Math.max(0, hp - beam.dmg));
    expect(beam.dmg).toBe(Math.max(1, Math.round(w.boss.hpMax * BEAM_SHARE * gain)));
  });
});

describe('fruit at the ball cap', () => {
  it('balls that do not fit become score, and the catch says how many', () => {
    const w = world(0);
    launch(w);
    w.queued = w.balls.cap - w.balls.n; // the swarm is already full
    const score = w.score;
    const n = multiplyBalls(w, 5);
    expect(n).toBe(w.balls.cap);
    expect(w.overflow).toBeGreaterThan(0);
    expect(w.score).toBeGreaterThan(score);
  });
});
