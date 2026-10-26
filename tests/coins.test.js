import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, PADDLE_Y, COIN_VALUE } from '../src/sim/constants.js';
import { parseLevel } from '../src/sim/levels.js';
import { addBall } from '../src/sim/balls.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

const idx = (c, r) => r * COLS + c;
const topRow = (r) => ROWS - 1 - r;
const run = (w, s, dt = 1 / 120) => { for (let t = 0; t < s; t += dt) stepWorld(w, dt); };

/** A sealed chamber with one parked ball keeps the stage alive. */
function sealed(extra = []) {
  const rows = Array.from({ length: 30 }, () => '.'.repeat(COLS).split(''));
  rows[29][0] = '#';
  for (let c = 0; c < COLS; c++) rows[28][c] = 'S';
  for (const [c, line, ch] of extra) rows[line][c] = ch;
  const w = createWorld(rows.map((r) => r.join('')), { rng: mulberry32(3) });
  w.state = 'play';
  w.balls.n = 0;
  addBall(w.balls, 30, ROWS - 10, 30, 0, 0);
  return w;
}

describe('gold coins', () => {
  it("'$' parses into a coin brick", () => {
    const g = parseLevel(['$']);
    expect(g.cells[idx(0, ROWS - 1)]).toBe(CELL.COIN);
  });

  it('breaking a coin brick drops a coin', () => {
    const w = sealed([[10, 2, '$']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.grid.cells[idx(10, topRow(2))]).toBe(CELL.EMPTY);
    expect(w.coins).toHaveLength(1);
    expect(w.drops).toHaveLength(0); // a coin is not a fruit
  });

  it('catching a coin adds gold without touching the swarm or the fruit streak', () => {
    const w = sealed();
    w.catchStreak = 3;
    setPaddleX(w, 20);
    w.coins = [{ x: 20, y: PADDLE_Y + 1 }];
    const before = w.balls.n + w.queued;
    run(w, 0.3);
    expect(w.gold).toBe(COIN_VALUE);
    expect(w.balls.n + w.queued).toBe(before);
    expect(w.catchStreak).toBe(3);
    expect(drainEvents(w).some((e) => e.t === 'coin' && e.gold === COIN_VALUE)).toBe(true);
  });

  it('a missed coin just falls away (no streak break)', () => {
    const w = sealed();
    w.catchStreak = 2;
    setPaddleX(w, 10);
    w.coins = [{ x: 80, y: PADDLE_Y + 1 }];
    run(w, 1);
    expect(w.coins).toHaveLength(0);
    expect(w.gold).toBe(0);
    expect(w.catchStreak).toBe(2);
  });

  it('losing a life clears coins still in the air', () => {
    const w = sealed();
    w.coins = [{ x: 50, y: 60 }];
    w.balls.n = 0;
    run(w, 0.05);
    expect(w.state).toBe('ready');
    expect(w.coins).toHaveLength(0);
  });
});
