import { describe, it, expect } from 'vitest';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../src/sim/world.js';
import { predictPath, AIM_MAX } from '../src/sim/aim.js';
import { COLS } from '../src/sim/constants.js';

function rng(seed = 3) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
/** A stage without its boss (the guide ignores the boss; it would only add noise here). */
const world = (n, seed = 3) => {
  const level = getLevel(n);
  return createWorld(level.lines, { box: level.box, holes: level.holes, boss: null, rng: rng(seed) });
};
/** Serves at `angle` and runs up to `seconds`: did a ball get into the box? */
const entersFor = (n, x, angle, dt = 1 / 120, seconds = 4) => {
  const w = world(n);
  setPaddleX(w, x);
  launch(w, angle);
  for (let t = 0; t < seconds && !w.entered; t += dt) stepWorld(w, dt);
  return w.entered;
};

describe('aimed serve', () => {
  it('fires along the aim, the same way every time (no random drift)', () => {
    const a = world(0, 1);
    const b = world(0, 99);
    launch(a, 0.4);
    launch(b, 0.4);
    expect(a.balls.n).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(a.balls.vx[i]).toBeCloseTo(b.balls.vx[i], 9);
      expect(a.balls.vy[i]).toBeCloseTo(b.balls.vy[i], 9);
    }
    // The middle ball flies exactly along the guide.
    expect(Math.atan2(a.balls.vx[1], a.balls.vy[1])).toBeCloseTo(0.4, 6);
  });

  it('an unaimed serve (keyboard or old callers) still works', () => {
    const w = world(0);
    expect(launch(w)).toBe(true);
    expect(w.state).toBe('play');
  });

  it('the aim is limited to what a ball can fly (never flatter than the game allows)', () => {
    expect(AIM_MAX).toBeGreaterThan(1);
    expect(AIM_MAX).toBeLessThan(Math.PI / 2);
  });
});

describe('aim guide', () => {
  it('starts at the ball on the paddle and goes up', () => {
    const w = world(0);
    const path = predictPath(w, 0);
    expect(path.points[0][0]).toBeCloseTo(w.paddle.x);
    expect(Math.max(...path.points.map((q) => q[1]))).toBeGreaterThan(path.points[0][1] + 10);
  });

  it('bends at the walls it bounces off', () => {
    const w = world(0);
    setPaddleX(w, 10);
    const path = predictPath(w, -0.9); // steeply toward the left wall
    expect(path.points.length).toBeGreaterThan(2);
    expect(Math.min(...path.points.map((p) => p[0]))).toBeLessThan(1);
  });

  it('when it says the shot goes in, a real serve at that aim gets in', () => {
    for (const n of [0, 1, 2, 3, 12]) {
      let found = 0;
      for (let x = 8; x <= COLS - 8; x += 11) {
        for (let a = -1.1; a <= 1.1; a += 0.1) {
          const w = world(n);
          setPaddleX(w, x);
          if (!predictPath(w, a).entered) continue;
          found++;
          expect(entersFor(n, x, a), `stage ${n} x ${x} aim ${a.toFixed(1)}`).toBe(true);
        }
      }
      expect(found, `stage ${n}: some aim gets in`).toBeGreaterThan(0);
    }
  }, 30_000); // hundreds of real serves: slower CI runners need more than the 5 s default

  it('holds at other frame rates too (60 Hz phones, 144 Hz screens)', () => {
    for (const dt of [1 / 60, 1 / 144]) {
      for (const n of [0, 3]) {
        for (let x = 8; x <= COLS - 8; x += 11) {
          for (let a = -1.1; a <= 1.1; a += 0.1) {
            const w = world(n);
            setPaddleX(w, x);
            if (!predictPath(w, a).entered) continue;
            expect(entersFor(n, x, a, dt), `dt ${dt.toFixed(4)} stage ${n} x ${x} aim ${a.toFixed(1)}`).toBe(true);
          }
        }
      }
    }
  }, 30_000);
});
