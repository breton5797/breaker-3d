import { describe, it, expect } from 'vitest';
import { carvePipe, inPipe, atPipeEnd, pipeStage, shapesFor, SHAPES, TIERS, PIPE_W, PIPE_PATIENCE } from '../src/sim/pipes.js';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, drainEvents } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { stageSlot } from '../src/sim/sequence.js';
import { ROWS } from '../src/sim/constants.js';

// Pipe stage (owner, 2026-11-02; docs/plans/2026-11-02-size-fullscreen-pipes): a winding steel pipe from
// a floor hole into the mural, longer and windier as stages rise; the ball may get through to the fruit
// or come back out. Physics only, plus a fixed "patience" turn that breaks endless loops.
const cell = (lines, x, y) => lines[ROWS - 1 - y][x];
const fruit = (ls) => ls.join('').replace(/[^ACDEIM]/g, '').length;
const plain = (n) => getLevel(n, { pipe: false });

describe('which stages get which pipes', () => {
  it('from stage 10 on, never a big-boss stage', () => {
    for (let n = 0; n < 9; n++) expect(pipeStage(n), `stage ${n + 1}`).toBe(false);
    for (let n = 9; n < 120; n++) expect(pipeStage(n), `stage ${n + 1}`).toBe(!stageSlot(n).boss);
  });

  it('the shapes get windier with the stage: each tier draws from its own list', () => {
    for (const t of TIERS) for (const name of t.shapes) expect(SHAPES[name], name).toBeTruthy();
    expect(shapesFor(9).every((s) => TIERS[0].shapes.includes(s))).toBe(true);
    expect(shapesFor(150).every((s) => TIERS.at(-1).shapes.includes(s))).toBe(true);
    const turns = (name) => SHAPES[name].length - 1;
    const avg = (t) => t.shapes.reduce((s, n) => s + turns(n), 0) / t.shapes.length;
    expect(avg(TIERS.at(-1))).toBeGreaterThan(avg(TIERS[0]));
  });

  it('every stage with a floor hole from 10 to 200 gets a pipe, and keeps exactly its fruit', () => {
    for (let n = 9; n < 200; n++) {
      if (!pipeStage(n) || !plain(n).holes.some((h) => h.side === 'bottom')) continue;
      const lvl = getLevel(n);
      expect(lvl.pipe, `stage ${n + 1}`).toBeTruthy();
      expect(fruit(lvl.lines), `stage ${n + 1}`).toBe(fruit(plain(n).lines));
    }
  });
});

describe('a carved pipe', () => {
  const lvl = plain(40); // 숫자 1: one floor hole with room either side
  const hole = lvl.holes.find((h) => h.side === 'bottom');
  const { lines, pipe } = carvePipe(lvl.lines, lvl.box, hole, SHAPES.snake, { name: 'snake' });

  it('opens its mouth as wide as the pipe (a 1-cell hole under a wide pipe traps balls)', () => {
    const [hx, floor] = hole.cells[0];
    const x0 = hx - Math.floor(PIPE_W / 2);
    for (let x = x0; x < x0 + PIPE_W; x++) expect(cell(lines, x, floor)).toBe('.');
  });

  it('is walled in steel: no open cell of the pipe touches a brick', () => {
    for (const k of pipe.cells) {
      const [x, y] = [k % 1024, Math.floor(k / 1024)];
      if (y === pipe.floor || atPipeEnd(pipe, x, y)) continue;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const ch = cell(lines, x + i, y + j);
        expect(ch === '.' || ch === 'S', `around (${x}, ${y})`).toBe(true);
      }
    }
  });

  it('knows its own cells and its far end', () => {
    expect(inPipe(pipe, hole.cells[0][0], pipe.floor + 3)).toBe(true);
    expect(inPipe(null, 10, 10)).toBe(false);
    const [k] = pipe.end;
    expect(atPipeEnd(pipe, k % 1024, Math.floor(k / 1024))).toBe(true);
  });

  it('does not fit when it would run into the box wall', () => {
    expect(carvePipe(lvl.lines, lvl.box, hole, [['U', 10], ['R', 80]])).toBeNull();
  });
});

describe('"들어갔다!" only when a ball gets out of the far end of the pipe', () => {
  const lvl = plain(40);
  const hole = lvl.holes.find((h) => h.side === 'bottom');
  const { lines, pipe } = carvePipe(lvl.lines, lvl.box, hole, SHAPES.L, { name: 'L' });
  const world = () => {
    const w = createWorld(lines, { box: lvl.box, holes: lvl.holes, pipe, rng: () => 0.5 });
    w.state = 'play';
    w.balls.n = 0;
    return w;
  };

  it('a ball inside the pipe makes only a click (pipe), not the entry celebration', () => {
    const w = world();
    addBall(w.balls, hole.cells[0][0], pipe.floor + 4, 0, 10, 0);
    stepWorld(w, 1 / 120);
    const ev = drainEvents(w).map((e) => e.t);
    expect(ev).toContain('pipe');
    expect(ev).not.toContain('enter');
    expect(w.entered).toBe(false);
  });

  it('a ball past the pipe in the mural is the entry', () => {
    const w = world();
    addBall(w.balls, (lvl.box.left + lvl.box.right) / 2, lvl.box.top - 3, 0, 10, 0);
    stepWorld(w, 1 / 120);
    expect(drainEvents(w).map((e) => e.t)).toContain('enter');
  });

  it('a ball rattling in the pipe longer than its patience turns (a fixed angle: no dice)', () => {
    const w = world();
    addBall(w.balls, hole.cells[0][0], pipe.floor + 4, 0, 0.001, 0); // nearly still: it stays put
    w.balls.piped[0] = PIPE_PATIENCE - 0.001;
    const before = Math.atan2(w.balls.vx[0], w.balls.vy[0]);
    stepWorld(w, 1 / 120);
    expect(Math.atan2(w.balls.vx[0], w.balls.vy[0])).not.toBeCloseTo(before, 3);
  });
});
