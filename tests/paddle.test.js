import { describe, it, expect } from 'vitest';
import { COLS, ROWS, PADDLE_Y, STUN_SHRINK } from '../src/sim/constants.js';
import { addBall } from '../src/sim/balls.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { paddleWidth } from '../src/sim/paddle.js';
import { updateShells } from '../src/sim/units.js';
import { mulberry32 } from '../src/sim/rng.js';

// A sealed upper chamber (steel floor) with one parked ball keeps the stage alive.
function sealed() {
  const rows = Array.from({ length: 30 }, () => '.'.repeat(COLS).split(''));
  rows[29][0] = '#';
  for (let c = 0; c < COLS; c++) rows[28][c] = 'S';
  const w = createWorld(rows.map((r) => r.join('')), { rng: mulberry32(4), paddleW: 12 });
  w.state = 'play';
  w.balls.n = 0;
  addBall(w.balls, 30, ROWS - 10, 30, 0, 0);
  return w;
}
const run = (w, s, dt = 1 / 120) => { for (let t = 0; t < s; t += dt) stepWorld(w, dt); };

function catchFruits(w, n, mult = 5) {
  const events = [];
  for (let k = 0; k < n; k++) {
    w.drops = [...w.drops, { x: w.paddle.x, y: PADDLE_Y + 3, mult }];
    run(w, 0.4);
    events.push(...drainEvents(w));
  }
  return events;
}

describe('paddle width', () => {
  it('shrinks while stunned and restores afterwards', () => {
    const w = sealed();
    expect(paddleWidth(w)).toBeCloseTo(12);
    w.stun = 1;
    expect(paddleWidth(w)).toBeCloseTo(12 * STUN_SHRINK);
    w.stun = 0.05;
    w.paddle = { ...w.paddle, w: paddleWidth(w) };
    updateShells(w, 0.1);
    expect(w.paddle.w).toBeCloseTo(12);
  });

  it('a paddle growing back against the wall stays inside the field', () => {
    const w = sealed();
    w.stun = 0.05;
    w.paddle = { ...w.paddle, w: paddleWidth(w), x: paddleWidth(w) / 2 };
    updateShells(w, 0.1);
    expect(w.paddle.x - w.paddle.w / 2).toBeGreaterThanOrEqual(0);
  });
});

describe('no fruit fever', () => {
  it('a long catch streak keeps the paddle width and the plain multipliers', () => {
    const w = sealed();
    const ev = catchFruits(w, 10, 10);
    expect(w.catchStreak).toBe(10);
    expect(w.paddle.w).toBeCloseTo(12);
    const collects = ev.filter((e) => e.t === 'collect');
    expect(collects).toHaveLength(10);
    expect(collects.every((e) => e.mult === 10)).toBe(true);
    expect(ev.some((e) => e.t === 'fever' || e.t === 'fever-end')).toBe(false);
  });

  it('falling fruit is never pulled sideways', () => {
    const w = sealed();
    catchFruits(w, 10);
    setPaddleX(w, 20);
    w.drops = [{ x: 70, y: 100, mult: 5 }];
    run(w, 0.5);
    expect(w.drops[0].x).toBe(70);
  });

  it('still records the best streak and the best fruit caught', () => {
    const w = sealed();
    catchFruits(w, 3, 5);
    catchFruits(w, 1, 100);
    expect(w.bestStreak).toBe(4);
    expect(w.bestFruit).toBe(100);
  });
});
