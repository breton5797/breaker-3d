import { describe, it, expect } from 'vitest';
import { COLS, ROWS, PADDLE_Y, FEVER_STREAK, FEVER_TIME, FEVER_WIDEN, STUN_SHRINK } from '../src/sim/constants.js';
import { addBall } from '../src/sim/balls.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { paddleWidth } from '../src/sim/fever.js';
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
const dropOnPaddle = (w, mult = 5) => { w.drops = [...w.drops, { x: w.paddle.x, y: PADDLE_Y + 3, mult }]; };

function catchFruits(w, n, mult = 5) {
  const events = [];
  for (let k = 0; k < n; k++) {
    dropOnPaddle(w, mult);
    run(w, 0.4);
    events.push(...drainEvents(w));
  }
  return events;
}

describe('fruit fever', () => {
  it(`starts after ${FEVER_STREAK} fruits caught in a row`, () => {
    const w = sealed();
    const before = catchFruits(w, FEVER_STREAK - 1);
    expect(w.fever).toBe(0);
    expect(before.some((e) => e.t === 'fever')).toBe(false);
    const ev = catchFruits(w, 1);
    expect(w.fever).toBeGreaterThan(FEVER_TIME - 0.5);
    expect(ev.some((e) => e.t === 'fever')).toBe(true);
    expect(w.fevers).toBe(1);
  });

  it('widens the paddle while active and restores it afterwards', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    expect(w.paddle.w).toBeCloseTo(12 * FEVER_WIDEN);
    run(w, FEVER_TIME + 0.5);
    expect(w.fever).toBe(0);
    expect(w.paddle.w).toBeCloseTo(12);
    expect(drainEvents(w).some((e) => e.t === 'fever-end')).toBe(true);
  });

  it('pulls falling fruit sideways toward the paddle', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    setPaddleX(w, 20);
    w.drops = [{ x: 70, y: 100, mult: 5 }];
    run(w, 0.5);
    expect(w.drops[0].x).toBeLessThan(70 - 5);
    expect(w.drops[0].x).toBeGreaterThanOrEqual(20);
  });

  it('does not pull fruit when fever is off', () => {
    const w = sealed();
    w.drops = [{ x: 70, y: 100, mult: 5 }];
    run(w, 0.5);
    expect(w.drops[0].x).toBe(70);
  });

  it('doubles the multiplier of fruit caught during fever', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    const ev = catchFruits(w, 1, 10);
    const got = ev.find((e) => e.t === 'collect');
    expect(got.mult).toBe(20);
    expect(got.fever).toBe(true);
  });

  it('a missed fruit does not cancel a running fever but resets the streak', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    setPaddleX(w, 10);
    w.drops = [{ x: 90, y: 3, mult: 5 }];
    run(w, 0.5);
    expect(w.catchStreak).toBe(0);
    expect(w.fever).toBeGreaterThan(0);
  });

  it('records the best streak and the best fruit caught', () => {
    const w = sealed();
    catchFruits(w, 3, 5);
    catchFruits(w, 1, 100);
    expect(w.bestStreak).toBe(4);
    expect(w.bestFruit).toBe(100);
  });

  it('catching more fruit during fever does not renew it (no endless fever)', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    run(w, 3);
    const left = w.fever;
    catchFruits(w, FEVER_STREAK);
    expect(w.fever).toBeLessThan(left);
    expect(w.fevers).toBe(1);
  });

  it('a new fever can start once the last one is over', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    run(w, FEVER_TIME + 0.5);
    catchFruits(w, FEVER_STREAK);
    expect(w.fever).toBeGreaterThan(0);
    expect(w.fevers).toBe(2);
  });

  it('widening at the wall keeps the paddle inside the field', () => {
    const w = sealed();
    setPaddleX(w, 0);
    catchFruits(w, FEVER_STREAK);
    expect(w.paddle.x - w.paddle.w / 2).toBeGreaterThanOrEqual(0);
  });

  it('a lethal bomb that costs a life ends the fever', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    w.lives = 3;
    w.shells = [{ x: w.paddle.x, y: PADDLE_Y + 0.2, vx: 0, vy: -1, tier: 10 }];
    updateShells(w, 0.01);
    expect(w.lives).toBe(2);
    expect(w.fever).toBe(0);
  });

  it('losing a life ends the fever', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    w.balls.n = 0;
    w.queued = 0; // otherwise owed balls respawn at the paddle
    run(w, 0.1);
    expect(w.state).toBe('ready');
    expect(w.fever).toBe(0);
    expect(w.paddle.w).toBeCloseTo(12);
  });
});

describe('paddle width', () => {
  it('stacks the fever widening with the stun shrink', () => {
    const w = sealed();
    expect(paddleWidth(w)).toBeCloseTo(12);
    w.fever = 1;
    expect(paddleWidth(w)).toBeCloseTo(12 * FEVER_WIDEN);
    w.stun = 1;
    expect(paddleWidth(w)).toBeCloseTo(12 * FEVER_WIDEN * STUN_SHRINK);
  });

  it('a stun wearing off during fever keeps the fever width', () => {
    const w = sealed();
    catchFruits(w, FEVER_STREAK);
    w.stun = 0.05;
    w.paddle = { ...w.paddle, w: paddleWidth(w) };
    updateShells(w, 0.1);
    expect(w.paddle.w).toBeCloseTo(12 * FEVER_WIDEN);
  });
});
