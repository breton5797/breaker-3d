import { describe, it, expect } from 'vitest';
import { carvePipe, inPipe, pipeStage, PIPE } from '../src/sim/pipes.js';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, drainEvents } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { stageSlot } from '../src/sim/sequence.js';
import { ROWS } from '../src/sim/constants.js';

// Pipe stage (owner, 2026-11-02; docs/plans/2026-11-02-size-fullscreen-pipes): an L pipe of steel from a
// floor hole into the mural; the ball may get through to the fruit or come back out. Physics only.
const cell = (lines, x, y) => lines[ROWS - 1 - y][x];

describe('which stages get a pipe', () => {
  it('stages 10-34 with a floor hole, never a big-boss stage, never before stage 10', () => {
    for (let n = 0; n < 9; n++) expect(pipeStage(n), `stage ${n + 1}`).toBe(false);
    for (let n = 9; n < 34; n++) expect(pipeStage(n), `stage ${n + 1}`).toBe(!stageSlot(n).boss);
    expect(pipeStage(34)).toBe(false);
  });

  it('getLevel gives those stages a pipe when their floor hole has room, and the others none', () => {
    let piped = 0;
    for (let n = 0; n < 40; n++) {
      const lvl = getLevel(n);
      if (!pipeStage(n)) expect(lvl.pipe, `stage ${n + 1}`).toBeNull();
      else if (lvl.pipe) piped++;
    }
    expect(piped).toBeGreaterThanOrEqual(12);
  });
});

describe('the pipe', () => {
  const lvl = getLevel(40); // 숫자 1: one floor hole with room either side
  const hole = lvl.holes.find((h) => h.side === 'bottom');
  const { lines, pipe } = carvePipe(lvl.lines, lvl.box, hole);

  it('opens its mouth as wide as the pipe (a 1-cell hole under a wide shaft traps balls)', () => {
    for (let x = pipe.x0; x < pipe.x0 + PIPE.W; x++) expect(cell(lines, x, pipe.floor)).toBe('.');
  });

  it('is steel on both sides of the shaft and capped above the bend', () => {
    for (let y = pipe.floor + 1; y < pipe.top - PIPE.W; y++) {
      expect(cell(lines, pipe.x0 - 1, y)).toBe('S');
      expect(cell(lines, pipe.x0 + PIPE.W, y)).toBe('S');
    }
    for (let x = pipe.x0; x < pipe.x0 + PIPE.W; x++) expect(cell(lines, x, pipe.top)).toBe('S');
  });

  it('keeps every fruit it cuts away (they move past its far end, the vault)', () => {
    const fruit = (ls) => ls.join('').replace(/[^ACDEIM]/g, '').length;
    expect(fruit(lines)).toBe(fruit(lvl.lines));
  });

  it('knows its own cells', () => {
    expect(inPipe(pipe, pipe.x0 + 1, pipe.floor + 3)).toBe(true);
    expect(inPipe(pipe, pipe.x0 + 1, pipe.top + 3)).toBe(false);
    expect(inPipe(null, 10, 10)).toBe(false);
  });
});

describe('"들어갔다!" only when a ball gets out of the far end of the pipe', () => {
  const lvl = getLevel(40);
  const hole = lvl.holes.find((h) => h.side === 'bottom');
  const { lines, pipe } = carvePipe(lvl.lines, lvl.box, hole);
  const world = () => {
    const w = createWorld(lines, { box: lvl.box, holes: lvl.holes, pipe, rng: () => 0.5 });
    w.state = 'play';
    w.balls.n = 0;
    return w;
  };

  it('a ball inside the pipe makes only a click (pipe), not the entry celebration', () => {
    const w = world();
    addBall(w.balls, pipe.x0 + 1, pipe.floor + 4, 0, 10, 0);
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
});
