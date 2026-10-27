import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, ITEM_MULT, PADDLE_Y } from '../src/sim/constants.js';
import { parseLevel, getLevel, stageParams, LEVELS } from '../src/sim/levels.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';

const idx = (c, r) => r * COLS + c;

function inspect(i) {
  const lvl = getLevel(i);
  const g = parseLevel(lvl.lines, { brickHp: lvl.params.brickHp, box: lvl.box, holes: lvl.holes });
  let items = 0;
  let coins = 0;
  let topTier = 0;
  let units = 0;
  for (let k = 0; k < g.cells.length; k++) {
    if (ITEM_MULT[g.cells[k]]) items++;
    if (g.cells[k] === CELL.COIN) coins++;
    if (g.cells[k] === CELL.UNIT) { units++; topTier = Math.max(topTier, g.tier[k]); }
  }
  return { lvl, g, items, coins, units, topTier };
}

describe('endless difficulty curve', () => {
  it('stages never run out', () => {
    for (const i of [199, 200, 999, 4999]) {
      expect(() => getLevel(i)).not.toThrow();
      expect(getLevel(i).index).toBe(i);
    }
  });

  it('every stage is harder than the one before (continuous knobs) and never easier (step knobs)', () => {
    let prev = stageParams(0);
    for (let i = 1; i < 1000; i++) {
      const p = stageParams(i);
      expect(p.holeCount).toBeLessThanOrEqual(prev.holeCount);
      expect(p.holeSize).toBeLessThanOrEqual(prev.holeSize);
      expect(p.brickHp).toBeGreaterThanOrEqual(prev.brickHp);
      expect(p.items).toBeLessThanOrEqual(prev.items);
      expect(p.coins).toBeLessThanOrEqual(prev.coins);
      expect(p.bigItemShare).toBeLessThanOrEqual(prev.bigItemShare);
      expect(p.lives).toBeLessThanOrEqual(prev.lives);
      expect(p.paddleW).toBeLessThanOrEqual(prev.paddleW);
      expect(p.unitTop).toBeGreaterThanOrEqual(prev.unitTop);
      expect(p.unitCount).toBeGreaterThanOrEqual(prev.unitCount);
      // These two rise on every single stage, forever.
      expect(p.dropSpeed).toBeGreaterThan(prev.dropSpeed);
      expect(p.aggression).toBeGreaterThan(prev.aggression);
      prev = p;
    }
  });

  it('stage 1 is a beginner stage; by stage 200 the step knobs are at their hardest', () => {
    const easy = stageParams(0);
    expect(easy.holeCount).toBe(4);
    expect(easy.items).toBe(16); // twice the 8 of the 1/10 cut
    expect(easy.coins).toBeGreaterThanOrEqual(40);
    expect(easy.brickHp).toBe(1);
    expect(easy.unitCount).toBe(0);
    expect(easy.lives).toBeGreaterThanOrEqual(5);
    const hard = stageParams(199);
    expect(hard.holeCount).toBe(1);
    expect(hard.holeSize).toBe(1);
    expect(hard.brickHp).toBe(3);
    expect(hard.unitTop).toBe(10);
    expect(hard.lives).toBe(3);
    // ...and the continuous knobs keep climbing past it, within playable limits.
    const later = stageParams(999);
    expect(later.dropSpeed).toBeGreaterThan(hard.dropSpeed);
    expect(later.aggression).toBeGreaterThan(hard.aggression);
    expect(stageParams(1e6).dropSpeed).toBeLessThan(30);
    expect(stageParams(1e6).aggression).toBeLessThan(3);
  });

  it('every handcrafted map appears within the first 60 stages', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(18);
    const seen = new Set();
    for (let i = 0; i < 60; i++) seen.add(getLevel(i).name.replace(/\s\d+$/, ''));
    for (const m of LEVELS) expect(seen.has(m.name)).toBe(true);
  });

  it('the 10 unit tiers are spread evenly across the 200 stages', () => {
    const firstStageOfTier = new Map();
    for (let i = 0; i < 200; i++) {
      const t = stageParams(i).unitTop;
      if (t && !firstStageOfTier.has(t)) firstStageOfTier.set(t, i + 1);
    }
    expect([...firstStageOfTier.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(firstStageOfTier.get(10)).toBeGreaterThan(150);
  });

  // Every handcrafted map (stages 1-18), then a sample of later stages.
  const sample = [...Array(18).keys(), 19, 33, 49, 74, 99, 124, 149, 174, 199, 299, 999];
  for (const i of sample) {
    it(`stage ${i + 1} is built to its parameters`, () => {
      const { lvl, items, coins, units, topTier } = inspect(i);
      const p = lvl.params;
      expect(lvl.lines.length).toBeLessThanOrEqual(ROWS - 14);
      for (const l of lvl.lines) expect(l.length).toBe(COLS);
      expect(lvl.holes).toHaveLength(p.holeCount);
      expect(items).toBeGreaterThanOrEqual(Math.floor(p.items * 0.8));
      expect(items).toBeLessThanOrEqual(p.items + p.unitCount); // only seeded fruit (veteran units drop extra later)
      expect(coins).toBeGreaterThanOrEqual(Math.floor(p.coins * 0.8));
      // A boss stage (every 10th) has no enemy units: the boss itself shoots.
      expect(units).toBe(lvl.bossStage ? 0 : p.unitCount);
      expect(topTier).toBe(lvl.bossStage ? 0 : p.unitTop);
      expect(lvl.name.length).toBeGreaterThan(0);
      // The box floor is the bottom line, and the sim still recognises it as the sealed floor.
      expect(lvl.box.bottom).toBe(ROWS - lvl.lines.length);
      const g = parseLevel(lvl.lines, { brickHp: p.brickHp, box: lvl.box, holes: lvl.holes });
      expect(g.floorRow).toBe(lvl.box.bottom);
    });
  }

  it('a world honours its stage lives, paddle width and release rate', () => {
    // The lone brick is caged in steel so released balls can never clear the stage.
    const w = createWorld(['S#S', '.S.'], { lives: 5, paddleW: 18, releaseRate: 15, dropSpeed: 20, aggression: 2 });
    expect(w.dropSpeed).toBe(20);
    expect(w.aggression).toBe(2);
    expect(w.lives).toBe(5);
    expect(w.paddle.w).toBe(18);
    setPaddleX(w, 0);
    expect(w.paddle.x).toBe(9); // clamped by the wider paddle
    w.state = 'play';
    addBall(w.balls, 30, ROWS - 5, 30, 0, 0);
    w.drops = [{ x: 9, y: PADDLE_Y + 1, mult: 100 }];
    for (let t = 0; t < 1.3; t += 1 / 120) stepWorld(w, 1 / 120);
    expect(drainEvents(w).some((e) => e.t === 'collect')).toBe(true);
    expect(w.balls.n).toBe(10); // pineapple x10: all ten balls arrive within ~1.2 s at 15/s
  });
});
