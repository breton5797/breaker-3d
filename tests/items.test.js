import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, MAX_BALLS, PADDLE_Y, ITEM_MULT } from '../src/sim/constants.js';
import { parseLevel, getLevel, LEVELS } from '../src/sim/levels.js';
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
    const w = world([[10, 2, 'A'], [0, 0, '#']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    addBall(w.balls, 30, 50, 30, 0, 0); // parked: rallies wall to wall, never falls
    run(w, 0.1);
    const { x } = w.drops[0];
    setPaddleX(w, x);
    run(w, 8);
    expect(w.drops).toHaveLength(0);
    expect(w.collected).toBe(1);
    expect(w.peakBalls).toBeGreaterThanOrEqual(5);
  });

  it('collecting emits a collect event with the multiplier', () => {
    const w = world([[0, 0, '#']]);
    addBall(w.balls, 30, 40, 0, 30, 0);
    w.drops = [{ x: 20, y: PADDLE_Y + 1, mult: 20 }];
    setPaddleX(w, 20);
    run(w, 0.3);
    expect(w.balls.n).toBe(20);
    expect(drainEvents(w).some((e) => e.t === 'collect' && e.mult === 20)).toBe(true);
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

  it('multiplication never exceeds MAX_BALLS', () => {
    const w = world([[0, 0, '#']]);
    for (let i = 0; i < 100; i++) addBall(w.balls, 30, 40, 0, 30, 0);
    w.drops = [{ x: 20, y: PADDLE_Y + 1, mult: 100 }];
    setPaddleX(w, 20);
    run(w, 0.3);
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

describe('narrow-entrance stages', () => {
  // The lowest occupied row of every built-in stage is a steel floor with one small hole.
  for (let i = 0; i < LEVELS.length + 2; i++) {
    it(`stage ${i + 1} is sealed by a steel floor with a 1-2 cell entrance and has items`, () => {
      const g = parseLevel(getLevel(i).lines);
      let floor = -1;
      for (let r = 0; r < ROWS && floor < 0; r++) {
        for (let c = 0; c < COLS; c++) if (g.cells[idx(c, r)] !== CELL.EMPTY) { floor = r; break; }
      }
      const open = [];
      for (let c = 0; c < COLS; c++) {
        const t = g.cells[idx(c, floor)];
        if (t !== CELL.STEEL) open.push(c);
      }
      expect(open.length).toBeGreaterThanOrEqual(1);
      expect(open.length).toBeLessThanOrEqual(2);
      expect(open[open.length - 1] - open[0]).toBe(open.length - 1); // one contiguous hole
      let items = 0;
      for (let k = 0; k < g.cells.length; k++) if (ITEM_MULT[g.cells[k]]) items++;
      expect(items).toBeGreaterThanOrEqual(6);
    });
  }
});
