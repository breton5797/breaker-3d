import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, MAX_BALLS, PADDLE_Y, SPLIT_USES, METEOR_COUNT, STALL_TIME } from '../src/sim/constants.js';
import { parseLevel, getLevel, LEVELS } from '../src/sim/levels.js';
import { addBall } from '../src/sim/balls.js';
import { createWorld, stepWorld, launch, setPaddleX, useSkill, drainEvents } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

const idx = (c, r) => r * COLS + c;
const topRow = (r) => ROWS - 1 - r; // text line r -> grid row

// Builds level lines with given chars placed at (col, textLine).
function lines(placements, height = 30) {
  const rows = Array.from({ length: height }, () => '.'.repeat(COLS).split(''));
  for (const [c, line, ch] of placements) rows[line][c] = ch;
  return rows.map((r) => r.join(''));
}

function world(placements, opts = {}) {
  const w = createWorld(lines(placements), { rng: mulberry32(7), ...opts });
  w.state = 'play';
  w.balls.n = 0;
  return w;
}

function run(w, seconds, dt = 1 / 120) {
  for (let t = 0; t < seconds; t += dt) stepWorld(w, dt);
}

describe('parseLevel', () => {
  it('maps text lines top-down into grid cells', () => {
    const grid = parseLevel(['#S2', '3B5', '-|G', 'FH.']);
    expect(grid.cells[idx(0, topRow(0))]).toBe(CELL.BRICK);
    expect(grid.cells[idx(1, topRow(0))]).toBe(CELL.STEEL);
    expect(grid.cells[idx(2, topRow(0))]).toBe(CELL.SPLIT2);
    expect(grid.cells[idx(0, topRow(1))]).toBe(CELL.SPLIT3);
    expect(grid.cells[idx(1, topRow(1))]).toBe(CELL.BOMB);
    expect(grid.cells[idx(2, topRow(1))]).toBe(CELL.SPLIT5);
    expect(grid.cells[idx(0, topRow(2))]).toBe(CELL.LASER_H);
    expect(grid.cells[idx(1, topRow(2))]).toBe(CELL.LASER_V);
    expect(grid.cells[idx(2, topRow(2))]).toBe(CELL.GOLD);
    expect(grid.cells[idx(0, topRow(3))]).toBe(CELL.FIRE);
    expect(grid.cells[idx(1, topRow(3))]).toBe(CELL.BRICK);
    expect(grid.hp[idx(1, topRow(3))]).toBe(2);
    expect(grid.cells[idx(2, topRow(3))]).toBe(CELL.EMPTY);
  });

  it('counts breakable cells (steel excluded)', () => {
    const grid = parseLevel(['#S#', 'SS2']);
    expect(grid.remaining).toBe(3);
  });

  it('every built-in level parses with bricks and fits the grid', () => {
    for (let i = 0; i < LEVELS.length + 3; i++) {
      const lvl = getLevel(i);
      expect(lvl.lines.length).toBeLessThanOrEqual(ROWS - 14);
      for (const l of lvl.lines) expect(l.length).toBe(COLS);
      expect(parseLevel(lvl.lines).remaining).toBeGreaterThan(50);
    }
  });
});

describe('ball vs cells', () => {
  it('breaks a brick and bounces back', () => {
    const w = world([[10, 2, '#']]);
    const r = topRow(2);
    addBall(w.balls, 10.5, r - 3, 0, 30, 0);
    run(w, 0.3);
    expect(w.grid.cells[idx(10, r)]).toBe(CELL.EMPTY);
    expect(w.balls.vy[0]).toBeLessThan(0);
    expect(drainEvents(w).some((e) => e.t === 'break')).toBe(true);
  });

  it('hard brick needs two hits', () => {
    const w = world([[10, 2, 'H']]);
    const r = topRow(2);
    addBall(w.balls, 10.5, r - 2, 0, 30, 0);
    run(w, 0.12);
    expect(w.grid.cells[idx(10, r)]).toBe(CELL.BRICK);
    expect(w.grid.hp[idx(10, r)]).toBe(1);
  });

  it('steel bounces without breaking', () => {
    const w = world([[10, 2, 'S'], [0, 0, '#']]);
    const r = topRow(2);
    addBall(w.balls, 10.5, r - 3, 0, 30, 0);
    run(w, 0.3);
    expect(w.grid.cells[idx(10, r)]).toBe(CELL.STEEL);
    expect(w.balls.vy[0]).toBeLessThan(0);
  });

  it('fire ball pierces bricks without bouncing', () => {
    const w = world([[10, 2, '#'], [10, 3, '#']]);
    addBall(w.balls, 10.5, topRow(3) - 3, 0, 30, 3);
    run(w, 0.3);
    expect(w.grid.cells[idx(10, topRow(2))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(10, topRow(3))]).toBe(CELL.EMPTY);
    expect(w.balls.vy[0]).toBeGreaterThan(0);
  });

  it('bounces off left, right and top walls', () => {
    const w = world([[47, 0, '#']]);
    addBall(w.balls, 0.6, 30, -30, 0, 0);
    addBall(w.balls, COLS - 0.6, 30, 30, 0, 0);
    addBall(w.balls, 20, ROWS - 0.6, 0, 30, 0);
    run(w, 0.05);
    expect(w.balls.vx[0]).toBeGreaterThan(0);
    expect(w.balls.vx[1]).toBeLessThan(0);
    expect(w.balls.vy[2]).toBeLessThan(0);
  });
});

describe('special cells', () => {
  it('split3 multiplies the ball into three', () => {
    const w = world([[10, 2, '3']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.balls.n).toBe(3);
    // A gate survives the pass and loses one use.
    expect(w.grid.cells[idx(10, topRow(2))]).toBe(CELL.SPLIT3);
    expect(w.grid.hp[idx(10, topRow(2))]).toBe(SPLIT_USES - 1);
  });

  it('gate multiplies a passing ball only once', () => {
    const w = world([[10, 2, '2'], [0, 0, '#']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.15); // ball fully crosses the cell over many substeps
    expect(w.balls.n).toBe(2);
  });

  it('gate wears out after SPLIT_USES passes', () => {
    const w = world([[10, 20, '2'], [0, 0, '#']]);
    for (let k = 0; k < SPLIT_USES; k++) addBall(w.balls, 10.5, topRow(20) - 2 - k * 1.5, 0, 30, 0);
    run(w, 0.6);
    expect(w.grid.cells[idx(10, topRow(20))]).toBe(CELL.EMPTY);
    expect(w.balls.n).toBe(SPLIT_USES * 2);
  });

  it('explosions pop gates into a burst of balls', () => {
    const w = world([[10, 5, 'B'], [11, 5, '3'], [0, 0, '#']]);
    addBall(w.balls, 10.5, topRow(5) - 2, 0, 30, 0);
    run(w, 0.2);
    expect(w.grid.cells[idx(11, topRow(5))]).toBe(CELL.EMPTY);
    expect(w.balls.n).toBeGreaterThanOrEqual(4);
  });

  it('split5 multiplies the ball into five', () => {
    const w = world([[10, 2, '5']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.balls.n).toBe(5);
  });

  it('never exceeds MAX_BALLS', () => {
    const w = world([[10, 2, '5']]);
    for (let i = 0; i < MAX_BALLS; i++) addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    expect(addBall(w.balls, 1, 1, 0, 1, 0)).toBe(false);
    run(w, 0.1);
    expect(w.balls.n).toBeLessThanOrEqual(MAX_BALLS);
  });

  it('bomb destroys its radius and chains into other bombs', () => {
    const placements = [[10, 5, 'B'], [13, 5, 'B'], [16, 5, '#'], [8, 6, '#'], [4, 5, '#']];
    const w = world(placements);
    addBall(w.balls, 10.5, topRow(5) - 2, 0, 30, 0);
    run(w, 1);
    expect(w.grid.cells[idx(10, topRow(5))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(13, topRow(5))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(16, topRow(5))]).toBe(CELL.EMPTY); // reached only via chain
    expect(w.grid.cells[idx(8, topRow(6))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(4, topRow(5))]).toBe(CELL.BRICK); // out of range
    expect(drainEvents(w).filter((e) => e.t === 'boom').length).toBe(2);
  });

  it('horizontal laser clears its row except steel', () => {
    const p = [[5, 4, '-'], [0, 4, '#'], [30, 4, '#'], [40, 4, 'S'], [30, 5, '#']];
    const w = world(p);
    addBall(w.balls, 5.5, topRow(4) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.grid.cells[idx(0, topRow(4))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(30, topRow(4))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(40, topRow(4))]).toBe(CELL.STEEL);
    expect(w.grid.cells[idx(30, topRow(5))]).toBe(CELL.BRICK);
  });

  it('vertical laser clears its column', () => {
    const w = world([[5, 8, '|'], [5, 1, '#'], [6, 1, '#']]);
    addBall(w.balls, 5.5, topRow(8) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.grid.cells[idx(5, topRow(1))]).toBe(CELL.EMPTY);
    expect(w.grid.cells[idx(6, topRow(1))]).toBe(CELL.BRICK);
  });

  it('fire cell ignites the ball', () => {
    const w = world([[10, 2, 'F']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.balls.fire[0]).toBeGreaterThan(0);
  });

  it('gold grants a skill charge', () => {
    const w = world([[10, 2, 'G']]);
    const before = w.charges.split + w.charges.meteor;
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.charges.split + w.charges.meteor).toBe(before + 1);
  });
});

describe('paddle, lives and flow', () => {
  it('reflects off the paddle with angle from the hit offset', () => {
    const w = world([[0, 0, '#']]);
    setPaddleX(w, 20);
    addBall(w.balls, 21.5, PADDLE_Y + 3, 0, -30, 0);
    run(w, 0.12);
    expect(w.balls.vy[0]).toBeGreaterThan(0);
    expect(w.balls.vx[0]).toBeGreaterThan(0);
  });

  it('loses a life when every ball falls and resets to ready', () => {
    const w = world([[0, 0, '#']]);
    setPaddleX(w, 40);
    addBall(w.balls, 5, 1.5, 0, -30, 0);
    const lives = w.lives;
    run(w, 0.3);
    expect(w.lives).toBe(lives - 1);
    expect(w.state).toBe('ready');
    expect(drainEvents(w).some((e) => e.t === 'lost')).toBe(true);
  });

  it('game over when no lives left', () => {
    const w = world([[0, 0, '#']]);
    w.lives = 1;
    setPaddleX(w, 40);
    addBall(w.balls, 5, 1.5, 0, -30, 0);
    run(w, 0.3);
    expect(w.state).toBe('over');
  });

  it('clears the level when the last breakable cell is gone', () => {
    const w = world([[10, 2, '#'], [20, 2, 'S']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.grid.remaining).toBe(0);
    expect(w.state).toBe('clear');
  });

  it('finale zaps the last few bricks once almost everything is gone', () => {
    const p = [];
    for (let c = 0; c < 40; c++) p.push([c, 1, '#']);
    p.push([2, 10, '#'], [30, 12, 'H']); // two stragglers far from any ball
    const w = world(p);
    w.grid.total = 1000; // pretend the level was big, so 2 left is under the threshold
    addBall(w.balls, 20, 30, 0, 30, 0);
    for (let c = 0; c < 40; c++) w.grid.cells[topRow(1) * COLS + c] = CELL.EMPTY;
    w.grid.remaining = 2;
    run(w, 0.05);
    expect(drainEvents(w).some((e) => e.t === 'finale')).toBe(true);
    run(w, 1);
    expect(w.grid.remaining).toBe(0);
    expect(w.state).toBe('clear');
  });

  it('finale also starts when play stalls near the end', () => {
    // One straggler the bouncing ball can never reach: it rallies straight up and down.
    const w = world([[2, 10, '#'], [3, 10, '#'], [4, 10, '#'], [5, 10, '#'], [0, 25, 'S']]);
    w.grid.total = 100; // 4% left: above the instant-finale line, under the stall line
    setPaddleX(w, 30);
    addBall(w.balls, 30, 30, 0, 30, 0);
    run(w, STALL_TIME - 1);
    expect(w.finale).toBe(false);
    run(w, 2);
    expect(w.finale).toBe(true);
  });

  it('launch fires the resting ball upward', () => {
    const w = createWorld(lines([[0, 0, '#']]), { rng: mulberry32(1) });
    expect(w.state).toBe('ready');
    launch(w);
    expect(w.state).toBe('play');
    expect(w.balls.n).toBe(1);
    expect(w.balls.vy[0]).toBeGreaterThan(0);
  });

  it('split skill triples balls and spends a charge', () => {
    const w = world([[0, 0, '#']]);
    w.charges.split = 1;
    addBall(w.balls, 20, 20, 0, 30, 0);
    addBall(w.balls, 25, 20, 0, 30, 0);
    expect(useSkill(w, 'split')).toBe(true);
    expect(w.balls.n).toBe(6);
    expect(w.charges.split).toBe(0);
    expect(useSkill(w, 'split')).toBe(false);
  });

  it('meteor skill fans out fire balls from the paddle', () => {
    const w = world([[0, 0, '#']]);
    w.charges.meteor = 1;
    expect(useSkill(w, 'meteor')).toBe(true);
    expect(w.balls.n).toBe(METEOR_COUNT);
    for (let i = 0; i < w.balls.n; i++) {
      expect(w.balls.fire[i]).toBeGreaterThan(0);
      expect(w.balls.vy[i]).toBeGreaterThan(0);
    }
  });

  it('awards score and tracks combo on breaks', () => {
    const w = world([[10, 2, '#'], [11, 2, '#']]);
    addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
    addBall(w.balls, 11.5, topRow(2) - 2, 0, 30, 0);
    run(w, 0.1);
    expect(w.score).toBeGreaterThan(0);
    expect(w.combo).toBe(2);
  });
});
