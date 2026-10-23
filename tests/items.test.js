import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, MAX_BALLS, PADDLE_Y, ITEM_MULT, FRUIT_GAIN } from '../src/sim/constants.js';
import { fruitGain } from '../src/sim/items.js';
import { parseLevel } from '../src/sim/levels.js';
import { addBall } from '../src/sim/balls.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

const idx = (c, r) => r * COLS + c;
const topRow = (r) => ROWS - 1 - r;

function world(placements) {
  const rows = Array.from({ length: 30 }, () => '.'.repeat(COLS).split(''));
  for (const [c, line, ch] of placements) rows[line][c] = ch;
  const w = createWorld(rows.map((r) => r.join('')), { rng: mulberry32(9) });
  w.state = 'play';
  w.balls.n = 0;
  return w;
}
const run = (w, s, dt = 1 / 120) => { for (let t = 0; t < s; t += dt) stepWorld(w, dt); };
// A sealed upper chamber (steel floor on text line 28) keeps released balls alive.
const sealed = () => world([[0, 29, '#'], ...Array.from({ length: COLS }, (_, c) => [c, 28, 'S'])]);
const CHAMBER_Y = ROWS - 10;

describe('multiplier item bricks', () => {
  it('parses item chars into item cells with their multipliers', () => {
    const g = parseLevel(['ACDEIM']);
    const types = [...'ACDEIM'].map((_, c) => g.cells[idx(c, ROWS - 1)]);
    expect(types.map((t) => ITEM_MULT[t])).toEqual([5, 10, 20, 30, 50, 100]);
  });

  it('breaking an item brick bounces the ball and drops a falling item', () => {
    const w = world([[10, 2, 'C'], [0, 0, '#']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.grid.cells[idx(10, topRow(2))]).toBe(CELL.EMPTY);
    expect(w.balls.vy[0]).toBeLessThan(0);
    expect(w.drops).toHaveLength(1);
    expect(w.drops[0].mult).toBe(10);
    expect(drainEvents(w).some((e) => e.t === 'drop' && e.mult === 10)).toBe(true);
  });

  it('a caught item multiplies the ball count', () => {
    // [0,0] is caged in steel so the stage can never clear mid-test.
    const w = world([[10, 2, 'A'], [0, 0, '#'], [1, 0, 'S'], [0, 1, 'S'], [1, 1, 'S']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    addBall(w.balls, 30, 50, 30, 0, 0); // parked: rallies wall to wall, never falls
    run(w, 0.1);
    const { x } = w.drops[0];
    setPaddleX(w, x);
    run(w, 1);
    const n0 = w.balls.n;
    let target = 0;
    for (let t = 0; t < 14 && !target; t += 1 / 120) {
      stepWorld(w, 1 / 120);
      target = drainEvents(w).find((e) => e.t === 'collect')?.n ?? 0;
    }
    expect(w.collected).toBe(1);
    expect(target).toBe(Math.round(n0 * 2.5)); // cherry: x2.5 after the 50% cut
    run(w, 10);
    expect(w.queued).toBe(0); // everything owed has been released
  });

  it('collecting emits a collect event with the fruit, its gain and the target count', () => {
    const w = world([[0, 0, '#']]);
    addBall(w.balls, 30, 60, 30, 0, 0); // parked: rallies wall to wall
    w.drops = [{ x: 20, y: PADDLE_Y + 1, mult: 20 }];
    setPaddleX(w, 20);
    run(w, 0.3);
    expect(drainEvents(w).some((e) => e.t === 'collect' && e.mult === 20 && e.gain === 10 && e.n === 10)).toBe(true);
  });

  it('every fruit multiplies by half its original amount', () => {
    expect(FRUIT_GAIN).toBe(0.5);
    expect([5, 10, 20, 30, 50, 100].map(fruitGain)).toEqual([2.5, 5, 10, 15, 25, 50]);
  });

  it('a cherry (x2.5) rounds the swarm to whole balls', () => {
    const w = sealed();
    addBall(w.balls, 30, CHAMBER_Y, 30, 0, 0);
    addBall(w.balls, 40, CHAMBER_Y - 4, 30, 0, 0);
    setPaddleX(w, 20);
    w.drops = [{ x: 20, y: PADDLE_Y + 1, mult: 5 }];
    run(w, 6);
    expect(w.balls.n).toBe(5);
  });

  it('a caught item releases its balls gradually, not all at once', () => {
    const w = sealed();
    addBall(w.balls, 30, CHAMBER_Y, 30, 0, 0);
    addBall(w.balls, 40, CHAMBER_Y - 4, 30, 0, 0);
    w.drops = [{ x: 20, y: PADDLE_Y + 1, mult: 100 }];
    setPaddleX(w, 20);
    run(w, 0.3);
    const early = w.balls.n;
    expect(early).toBeGreaterThan(2);
    expect(early).toBeLessThan(150); // a visible burst, not an instant pop
    run(w, 6);
    // ...and the whole catch has arrived within a few seconds (pineapple: x50).
    expect(w.balls.n).toBe(100);
    expect(w.queued).toBe(0);
  });

  it('every fruit caught keeps growing the swarm (no plateau)', () => {
    const w = sealed();
    addBall(w.balls, 30, CHAMBER_Y, 30, 0, 0);
    setPaddleX(w, 20);
    const counts = [];
    for (const mult of [10, 10, 10, 10]) { // strawberries: x5 each
      w.drops = [{ x: 20, y: PADDLE_Y + 1, mult }];
      run(w, 8, 1 / 60);
      counts.push(w.balls.n);
    }
    expect(counts).toEqual([5, 25, 125, 625]);
  });

  it('the ball cap is high enough for thousands of balls', () => {
    expect(MAX_BALLS).toBeGreaterThanOrEqual(4000);
  });

  it('consecutive catches build a catch combo that a miss resets', () => {
    const w = sealed();
    addBall(w.balls, 30, CHAMBER_Y, 30, 0, 0);
    setPaddleX(w, 20);
    const catchOne = (x, mult) => {
      w.drops = [{ x, y: PADDLE_Y + 1, mult }];
      run(w, 0.3);
      return drainEvents(w);
    };
    expect(catchOne(20, 5).find((e) => e.t === 'collect').streak).toBe(1);
    expect(catchOne(20, 10).find((e) => e.t === 'collect').streak).toBe(2);
    expect(catchOne(20, 5).find((e) => e.t === 'collect').streak).toBe(3);
    expect(w.catchStreak).toBe(3);
    w.drops = [{ x: 80, y: PADDLE_Y + 1, mult: 5 }]; // far from the paddle
    run(w, 1);
    expect(w.catchStreak).toBe(0);
    expect(catchOne(20, 5).find((e) => e.t === 'collect').streak).toBe(1);
  });

  it('a missed item falls away without multiplying', () => {
    const w = world([[0, 0, '#']]);
    addBall(w.balls, 30, 40, 0, 30, 0);
    w.drops = [{ x: 5, y: PADDLE_Y + 1, mult: 100 }];
    setPaddleX(w, 40);
    run(w, 1);
    expect(w.drops).toHaveLength(0);
    expect(w.balls.n).toBe(1);
    expect(drainEvents(w).some((e) => e.t === 'miss')).toBe(true);
  });

  it('released balls are born inside the wall when any ball is in there', () => {
    // Steel floor on text line 20 with a hole; one ball inside, many outside.
    const p = [[0, 29, '#']];
    for (let c = 0; c < COLS; c++) if (c < 40 || c > 42) p.push([c, 20, 'S']);
    const w = world(p);
    const floorY = ROWS - 1 - 20;
    addBall(w.balls, 30, ROWS - 3, 30, 0, 0); // inside, rallying under the ceiling
    for (let i = 0; i < 30; i++) addBall(w.balls, 10 + i, floorY - 20, 30, 0, 0); // outside, below the floor
    w.queued = 40;
    w.releaseRate = 40;
    run(w, 0.5);
    let insideBorn = 0;
    for (let i = 31; i < w.balls.n; i++) if (w.balls.y[i] > floorY) insideBorn++;
    expect(w.balls.n).toBeGreaterThan(40);
    expect(insideBorn).toBe(w.balls.n - 31);
  });

  it('multiplication never exceeds MAX_BALLS', () => {
    const w = sealed();
    for (let i = 0; i < MAX_BALLS - 40; i++) addBall(w.balls, 30, CHAMBER_Y - (i % 12), 30, 0, 0);
    w.drops = [{ x: 20, y: PADDLE_Y + 1, mult: 100 }];
    setPaddleX(w, 20);
    run(w, 15, 1 / 30);
    expect(w.balls.n).toBe(MAX_BALLS);
  });

  it('explosions also release items', () => {
    const w = world([[10, 5, 'B'], [11, 5, 'I'], [0, 0, '#']]);
    addBall(w.balls, 10.5, topRow(5) - 2, 0, 30, 0);
    run(w, 0.2);
    expect(w.drops.some((d) => d.mult === 50)).toBe(true);
  });

  it('losing the last ball clears falling items', () => {
    const w = world([[0, 0, '#']]);
    setPaddleX(w, 40);
    addBall(w.balls, 5, 1.5, 0, -30, 0);
    w.drops = [{ x: 20, y: 40, mult: 5 }];
    run(w, 0.3);
    expect(w.state).toBe('ready');
    expect(w.drops).toHaveLength(0);
  });
});
