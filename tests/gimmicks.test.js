import { describe, it, expect } from 'vitest';
import { createGimmick, bendBall, updateGimmick, STORM_PERIOD, STORM_WARNING, MIN_VY } from '../src/sim/gimmicks.js';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, drainEvents } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { CELL, COLS } from '../src/sim/constants.js';

/** A seeded random source so tests are repeatable. */
function rng(seed = 7) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function world(theme, n = 30) {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, rng: rng() });
  w.gimmick = createGimmick(theme, { box: level.box, rng: rng(11) });
  return { w, box: level.box };
}

const speed = (b, i) => Math.hypot(b.vx[i], b.vy[i]);

describe('gimmick setup', () => {
  it('landmarks (no theme) have no gimmick', () => {
    expect(createGimmick(null, { box: getLevel(0).box, rng: rng() })).toBeNull();
  });

  it('is the same for the same seed (a stage always plays the same)', () => {
    const box = getLevel(30).box;
    expect(createGimmick('space', { box, rng: rng(5) })).toEqual(createGimmick('space', { box, rng: rng(5) }));
  });
});

describe('space: gravity wells', () => {
  it('places its wells inside the steel box', () => {
    const { w, box } = world('space');
    expect(w.gimmick.wells.length).toBeGreaterThanOrEqual(1);
    for (const well of w.gimmick.wells) {
      expect(well.x).toBeGreaterThan(box.left);
      expect(well.x).toBeLessThan(box.right + 1);
      expect(well.y).toBeGreaterThan(box.bottom);
      expect(well.y).toBeLessThan(box.top + 1);
    }
  });

  it('bends a passing ball toward the well, without changing its speed', () => {
    const { w } = world('space');
    const well = w.gimmick.wells[0];
    addBall(w.balls, well.x - 4, well.y + 3, 0, -40); // falling straight down, left of the well
    const s0 = speed(w.balls, 0);
    for (let k = 0; k < 10; k++) bendBall(w.gimmick, w.balls, 0, 1 / 60);
    expect(w.balls.vx[0]).toBeGreaterThan(0); // pulled right, toward the well
    expect(speed(w.balls, 0)).toBeCloseTo(s0, 5);
  });

  it('never bends a ball flat (it could bounce wall to wall in a cleared row forever)', () => {
    const { w } = world('space');
    const well = w.gimmick.wells[0];
    // Passing just under the well, almost sideways: the pull would flatten it further.
    addBall(w.balls, well.x - 6, well.y - 0.6, 40, -3);
    for (let k = 0; k < 120; k++) bendBall(w.gimmick, w.balls, 0, 1 / 60);
    expect(Math.abs(w.balls.vy[0]) / speed(w.balls, 0)).toBeGreaterThanOrEqual(MIN_VY - 1e-6);
  });

  it('leaves balls far from every well alone', () => {
    const { w } = world('space');
    const far = { x: 2, y: 2 };
    addBall(w.balls, far.x, far.y, 10, 30);
    bendBall(w.gimmick, w.balls, 0, 1 / 60);
    expect(w.balls.vx[0]).toBe(10);
    expect(w.balls.vy[0]).toBe(30);
  });
});

describe('deep sea: currents', () => {
  it('pushes a ball inside a band along the current, keeping its speed', () => {
    const { w } = world('sea');
    const band = w.gimmick.bands[0];
    addBall(w.balls, (band.left + band.right) / 2, (band.bottom + band.top) / 2, 0, 40);
    const s0 = speed(w.balls, 0);
    for (let k = 0; k < 20; k++) bendBall(w.gimmick, w.balls, 0, 1 / 60);
    expect(Math.sign(w.balls.vx[0])).toBe(band.dir);
    expect(speed(w.balls, 0)).toBeCloseTo(s0, 5);
  });

  it('never lets a ball drift sideways forever (keeps some vertical speed, same direction)', () => {
    const { w } = world('sea');
    const band = w.gimmick.bands[0];
    addBall(w.balls, (band.left + band.right) / 2, (band.bottom + band.top) / 2, 0, 40);
    for (let k = 0; k < 600; k++) bendBall(w.gimmick, w.balls, 0, 1 / 60);
    expect(w.balls.vy[0]).toBeGreaterThan(0);
    expect(Math.abs(w.balls.vy[0]) / speed(w.balls, 0)).toBeGreaterThanOrEqual(MIN_VY - 1e-6); // balls are stored as Float32
  });

  it('has bands flowing both ways, all inside the box', () => {
    const { w, box } = world('sea');
    const dirs = new Set(w.gimmick.bands.map((b) => b.dir));
    expect(dirs).toEqual(new Set([1, -1]));
    for (const b of w.gimmick.bands) {
      expect(b.bottom).toBeGreaterThan(box.bottom);
      expect(b.top).toBeLessThanOrEqual(box.top);
    }
  });
});

describe('nature: lightning storms', () => {
  const run = (w, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) updateGimmick(w, 1 / 60); };

  it('warns first, then strikes the same column', () => {
    const { w } = world('nature');
    w.state = 'play';
    run(w, STORM_PERIOD + STORM_WARNING + 0.5);
    const ev = drainEvents(w);
    const warn = ev.find((e) => e.t === 'storm-warn');
    const strike = ev.find((e) => e.t === 'storm');
    expect(warn).toBeTruthy();
    expect(strike).toBeTruthy();
    expect(strike.c).toBe(warn.c);
    expect(ev.indexOf(warn)).toBeLessThan(ev.indexOf(strike));
  });

  it('a strike breaks bricks in its column but never steel', () => {
    const { w } = world('nature');
    w.state = 'play';
    const before = w.grid.remaining;
    const steel = w.grid.cells.filter((c) => c === CELL.STEEL).length;
    run(w, STORM_PERIOD + STORM_WARNING + 0.5);
    expect(w.grid.remaining).toBeLessThan(before);
    expect(w.grid.cells.filter((c) => c === CELL.STEEL).length).toBe(steel);
    const strike = drainEvents(w).find((e) => e.t === 'storm');
    expect(strike.c).toBeGreaterThanOrEqual(0);
    expect(strike.c).toBeLessThan(COLS);
  });

  it('holds off while the ball waits on the paddle', () => {
    const { w } = world('nature');
    w.state = 'ready';
    run(w, STORM_PERIOD * 3);
    expect(drainEvents(w).some((e) => e.t === 'storm' || e.t === 'storm-warn')).toBe(false);
  });
});
