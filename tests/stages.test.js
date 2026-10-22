import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, ITEM_MULT, PADDLE_Y } from '../src/sim/constants.js';
import { parseLevel, getLevel, stageParams, STAGE_COUNT } from '../src/sim/levels.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';

const idx = (c, r) => r * COLS + c;

function inspect(i) {
  const lvl = getLevel(i);
  const g = parseLevel(lvl.lines, { brickHp: lvl.params.brickHp });
  let floor = -1;
  for (let r = 0; r < ROWS && floor < 0; r++) {
    for (let c = 0; c < COLS; c++) if (g.cells[idx(c, r)] !== CELL.EMPTY) { floor = r; break; }
  }
  const hole = [];
  for (let c = 0; c < COLS; c++) if (g.cells[idx(c, floor)] === CELL.EMPTY) hole.push(c);
  let items = 0;
  let topTier = 0;
  let units = 0;
  for (let k = 0; k < g.cells.length; k++) {
    if (ITEM_MULT[g.cells[k]]) items++;
    if (g.cells[k] === CELL.UNIT) { units++; topTier = Math.max(topTier, g.tier[k]); }
  }
  return { lvl, g, hole, items, units, topTier };
}

describe('200-stage difficulty curve', () => {
  it('has exactly 200 stages', () => {
    expect(STAGE_COUNT).toBe(200);
    expect(() => getLevel(199)).not.toThrow();
  });

  it('every knob moves only toward "harder" as the stage number rises', () => {
    let prev = stageParams(0);
    for (let i = 1; i < STAGE_COUNT; i++) {
      const p = stageParams(i);
      expect(p.holeW).toBeLessThanOrEqual(prev.holeW);
      expect(p.brickHp).toBeGreaterThanOrEqual(prev.brickHp);
      expect(p.items).toBeLessThanOrEqual(prev.items);
      expect(p.bigItemShare).toBeLessThanOrEqual(prev.bigItemShare);
      expect(p.releaseRate).toBeLessThanOrEqual(prev.releaseRate);
      expect(p.lives).toBeLessThanOrEqual(prev.lives);
      expect(p.paddleW).toBeLessThanOrEqual(prev.paddleW);
      expect(p.unitTop).toBeGreaterThanOrEqual(prev.unitTop);
      expect(p.unitCount).toBeGreaterThanOrEqual(prev.unitCount);
      prev = p;
    }
  });

  it('stage 1 is a beginner stage and stage 200 is the hardest', () => {
    const easy = stageParams(0);
    expect(easy.holeW).toBeGreaterThanOrEqual(12);
    expect(easy.brickHp).toBe(1);
    expect(easy.unitCount).toBe(0);
    expect(easy.lives).toBeGreaterThanOrEqual(5);
    const hard = stageParams(199);
    expect(hard.holeW).toBeLessThanOrEqual(3);
    expect(hard.brickHp).toBeGreaterThanOrEqual(4);
    expect(hard.unitTop).toBe(10);
    expect(hard.lives).toBe(3);
  });

  it('the 10 unit tiers are spread evenly across the 200 stages', () => {
    const firstStageOfTier = new Map();
    for (let i = 0; i < STAGE_COUNT; i++) {
      const t = stageParams(i).unitTop;
      if (t && !firstStageOfTier.has(t)) firstStageOfTier.set(t, i + 1);
    }
    expect([...firstStageOfTier.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(firstStageOfTier.get(10)).toBeGreaterThan(150);
  });

  // Building all 200 is cheap enough; sample densely to keep the run fast.
  const sample = [0, 1, 2, 4, 7, 8, 9, 10, 19, 33, 49, 74, 99, 124, 149, 174, 198, 199];
  for (const i of sample) {
    it(`stage ${i + 1} is built to its parameters`, () => {
      const { lvl, hole, items, units, topTier } = inspect(i);
      const p = lvl.params;
      expect(lvl.lines.length).toBeLessThanOrEqual(ROWS - 14);
      for (const l of lvl.lines) expect(l.length).toBe(COLS);
      expect(hole.length).toBe(p.holeW);
      expect(hole[hole.length - 1] - hole[0]).toBe(hole.length - 1);
      expect(items).toBeGreaterThanOrEqual(Math.floor(p.items * 0.8));
      expect(units).toBe(p.unitCount);
      expect(topTier).toBe(p.unitTop);
      expect(lvl.name.length).toBeGreaterThan(0);
    });
  }

  it('a world honours its stage lives, paddle width and release rate', () => {
    // The lone brick is caged in steel so released balls can never clear the stage.
    const w = createWorld(['S#S', '.S.'], { lives: 5, paddleW: 18, releaseRate: 15 });
    expect(w.lives).toBe(5);
    expect(w.paddle.w).toBe(18);
    setPaddleX(w, 0);
    expect(w.paddle.x).toBe(9); // clamped by the wider paddle
    w.state = 'play';
    addBall(w.balls, 30, ROWS - 5, 30, 0, 0);
    w.drops = [{ x: 9, y: PADDLE_Y + 1, mult: 100 }];
    for (let t = 0; t < 1.3; t += 1 / 120) stepWorld(w, 1 / 120);
    expect(drainEvents(w).some((e) => e.t === 'collect')).toBe(true);
    expect(w.balls.n).toBeGreaterThanOrEqual(15); // ~1.2 s at 15/s
  });
});
