import { describe, it, expect } from 'vitest';
import { stageSlot, BOSS_EVERY } from '../src/sim/sequence.js';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, drainEvents } from '../src/sim/world.js';
import { hitCell, breakCell } from '../src/sim/cells.js';
import { addBall } from '../src/sim/balls.js';
import { updateBoss, REGEN_EVERY, CORE_BLAST, SHOT_EVERY } from '../src/sim/boss.js';
import { CELL, COLS } from '../src/sim/constants.js';

const bossWorld = (n = 9) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: () => 0.5 });
  return { level, w };
};
const coreCells = (w) => [...w.grid.cells.keys()].filter((i) => w.grid.cells[i] === CELL.CORE);
const at = (i) => ({ c: i % COLS, r: Math.floor(i / COLS) });

describe('stage order with bosses', () => {
  it('every 10th stage is a boss (stage 10, 20, 30 ...)', () => {
    expect(BOSS_EVERY).toBe(10);
    expect(stageSlot(9).boss).toBe(true);
    expect(stageSlot(19).boss).toBe(true);
    expect(stageSlot(8).boss).toBe(false);
    expect(stageSlot(10).boss).toBe(false);
  });

  it('bosses do not swallow regular maps: content runs on without gaps', () => {
    const contents = [];
    for (let n = 0; n < 40; n++) if (!stageSlot(n).boss) contents.push(stageSlot(n).content);
    expect(contents).toEqual([...Array(contents.length).keys()]);
  });

  it('the bosses take turns', () => {
    expect(stageSlot(9).bossIndex).toBe(0);
    expect(stageSlot(19).bossIndex).toBe(1);
    expect(stageSlot(29).bossIndex).toBe(2);
  });
});

describe('boss stage', () => {
  it('is announced as a boss and carries a core', () => {
    const { level, w } = bossWorld();
    expect(level.boss).toBeTruthy();
    expect(level.name).toMatch(/^BOSS/);
    expect(coreCells(w).length).toBeGreaterThan(0);
    expect(w.boss.alive).toBe(true);
    for (const i of coreCells(w)) expect(w.grid.hp[i]).toBe(level.boss.coreHp);
  });

  it('regular stages have no boss', () => {
    expect(getLevel(8).boss).toBeNull();
    const level = getLevel(10);
    const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss });
    expect(w.boss).toBeNull();
  });

  it('a ball chips the core one point at a time (fire balls too)', () => {
    const { w } = bossWorld();
    const i = coreCells(w)[0];
    const { c, r } = at(i);
    addBall(w.balls, c + 0.5, r - 0.5, 0, 30, 5); // a fire ball
    const hp = w.grid.hp[i];
    expect(hitCell(w, c, r, 0)).toBe(true); // bounces off
    expect(w.grid.hp[i]).toBe(hp - 1);
    expect(w.grid.cells[i]).toBe(CELL.CORE);
  });

  it('explosions only crack it (no one-shot core)', () => {
    const { w } = bossWorld();
    const i = coreCells(w)[0];
    const { c, r } = at(i);
    const hp = w.grid.hp[i];
    breakCell(w, c, r, -1);
    expect(w.grid.cells[i]).toBe(CELL.CORE);
    expect(w.grid.hp[i]).toBe(hp - CORE_BLAST);
  });

  it('while the core lives, broken armour grows back, nearest the core first', () => {
    const { w } = bossWorld();
    w.state = 'play';
    const armour = w.boss.armour.slice(0, 5);
    for (const i of armour) breakCell(w, i % COLS, Math.floor(i / COLS), -1);
    const low = w.grid.remaining;
    drainEvents(w);
    updateBoss(w, REGEN_EVERY + 0.01);
    expect(w.grid.remaining).toBeGreaterThan(low);
    expect(drainEvents(w).some((e) => e.t === 'regen')).toBe(true);
    expect(w.grid.cells[armour[0]]).toBe(CELL.BRICK);
  });

  it('killing every core brings the boss down: no more regrowth, the rest shatters', () => {
    const { w } = bossWorld();
    w.state = 'play';
    w.boss.budget = Infinity; // this test is about the knockout, not the damage budget
    for (const i of coreCells(w)) {
      w.grid.hp[i] = 1;
      hitCell(w, i % COLS, Math.floor(i / COLS), -1);
    }
    const ev = drainEvents(w);
    expect(ev.some((e) => e.t === 'boss-down')).toBe(true);
    expect(w.boss.alive).toBe(false);
    expect(w.finale).toBe(true);
    const armour = w.boss.armour[0];
    breakCell(w, armour % COLS, Math.floor(armour / COLS), -1);
    const remaining = w.grid.remaining;
    updateBoss(w, REGEN_EVERY * 3);
    expect(w.grid.remaining).toBeLessThanOrEqual(remaining);
  });

  it('a swarm cannot melt the core: it takes at most its damage budget per second (the rest bounce off a shield)', () => {
    const { level, w } = bossWorld();
    w.state = 'play';
    const cells = coreCells(w);
    const hp0 = cells.reduce((s, i) => s + w.grid.hp[i], 0);
    // 400 ball hits in one instant...
    for (let k = 0; k < 400; k++) {
      const i = cells[k % cells.length];
      if (w.grid.cells[i] === CELL.CORE) hitCell(w, i % COLS, Math.floor(i / COLS), -1);
    }
    const dealt = hp0 - cells.reduce((s, i) => s + (w.grid.cells[i] === CELL.CORE ? w.grid.hp[i] : 0), 0);
    expect(dealt).toBeLessThanOrEqual(level.boss.dps * 2); // at most two seconds' worth banked
    expect(drainEvents(w).some((e) => e.t === 'core-shield')).toBe(true);
    // ...and the budget refills with time.
    updateBoss(w, 1);
    const before = w.grid.hp[cells.find((i) => w.grid.cells[i] === CELL.CORE)];
    const i = cells.find((j) => w.grid.cells[j] === CELL.CORE);
    hitCell(w, i % COLS, Math.floor(i / COLS), -1);
    expect(w.grid.hp[i]).toBe(before - 1);
  });

  it('the usual "nearly done" finale waits until the boss is down', () => {
    const { w } = bossWorld();
    w.state = 'play';
    addBall(w.balls, 5, 5, 0, 30);
    w.grid.remaining = 3; // pretend almost everything is gone
    stepWorld(w, 1 / 60);
    expect(w.finale).toBe(false);
  });

  it('the boss fires at the paddle during play, not before launch', () => {
    const { w } = bossWorld();
    w.state = 'ready';
    updateBoss(w, SHOT_EVERY * 2);
    expect(w.shells.length).toBe(0);
    w.state = 'play';
    updateBoss(w, SHOT_EVERY + 0.01);
    expect(w.shells.length).toBeGreaterThan(0);
    expect(w.shells[0].vy).toBeLessThan(0);
  });
});
