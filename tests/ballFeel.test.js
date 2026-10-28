import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, drainEvents, launch, setPaddleX } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { BALL_SPEED, WALL_EVENTS_MAX, COLS } from '../src/sim/constants.js';

const world = (n = 0) => {
  const level = getLevel(n);
  return createWorld(level.lines, { box: level.box, holes: level.holes, boss: null, rng: () => 0.5 });
};

describe('ball feel', () => {
  it('balls fly twice as fast as before (36 -> 72 cells per second)', () => {
    expect(BALL_SPEED).toBe(72);
    const w = world();
    launch(w, 0);
    expect(Math.hypot(w.balls.vx[1], w.balls.vy[1])).toBeCloseTo(72, 6);
  });

  it('a ball bouncing off the steel box or the field wall makes a wall knock (with where it hit)', () => {
    const w = world();
    setPaddleX(w, 20);
    launch(w, -0.9); // toward the left wall
    const ev = [];
    for (let t = 0; t < 2; t += 1 / 120) { stepWorld(w, 1 / 120); ev.push(...drainEvents(w)); }
    const walls = ev.filter((e) => e.t === 'wall');
    expect(walls.length).toBeGreaterThan(0);
    for (const e of walls) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(COLS);
      expect(Number.isFinite(e.y)).toBe(true);
    }
  });

  it('thousands of balls never flood the events: a few wall knocks per step at most', () => {
    const w = world();
    launch(w, 0);
    for (let k = 0; k < 2000; k++) addBall(w.balls, 0.5 + (k % 95), 20 + (k % 30), (k % 2 ? 1 : -1) * 60, 40, 0);
    stepWorld(w, 1 / 60);
    expect(drainEvents(w).filter((e) => e.t === 'wall').length).toBeLessThanOrEqual(WALL_EVENTS_MAX);
  });

  it('the director answers wall and paddle knocks with sparks, a sound and a nudge', () => {
    const src = readFileSync(new URL('../src/director.js', import.meta.url), 'utf8');
    expect(src).toMatch(/case 'wall':/);
    expect(src).toMatch(/audio\.wallKnock\(/);
    const audio = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
    expect(audio).toMatch(/wallKnock\(/);
  });
});
