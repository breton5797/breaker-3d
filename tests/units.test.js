import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL, PADDLE_Y, PADDLE_W, UNIT_TIERS, UNIT_CHARS } from '../src/sim/constants.js';
import { parseLevel } from '../src/sim/levels.js';
import { addBall } from '../src/sim/balls.js';
import { createWorld, stepWorld, setPaddleX, drainEvents } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

const idx = (c, r) => r * COLS + c;
const topRow = (r) => ROWS - 1 - r;

function world(placements) {
  const rows = Array.from({ length: 30 }, () => '.'.repeat(COLS).split(''));
  for (const [c, line, ch] of placements) rows[line][c] = ch;
  const w = createWorld(rows.map((r) => r.join('')), { rng: mulberry32(4) });
  w.state = 'play';
  w.balls.n = 0;
  return w;
}
const run = (w, s, dt = 1 / 120) => { for (let t = 0; t < s; t += dt) stepWorld(w, dt); };
const unitChar = (tier) => UNIT_CHARS[tier - 1];
// A ball that rallies wall to wall forever so the world never runs out of balls.
const park = (w) => addBall(w.balls, 30, 50, 30, 0, 0);

describe('unit tiers', () => {
  it('defines 10 tiers that get strictly harder', () => {
    expect(UNIT_TIERS).toHaveLength(10);
    for (let k = 1; k < 10; k++) {
      const a = UNIT_TIERS[k - 1];
      const b = UNIT_TIERS[k];
      expect(b.hp).toBeGreaterThanOrEqual(a.hp);
      expect(b.interval).toBeLessThan(a.interval);
      expect(b.speed).toBeGreaterThan(a.speed);
      expect(b.shots).toBeGreaterThanOrEqual(a.shots);
      expect(b.stun).toBeGreaterThan(a.stun);
    }
    expect(UNIT_TIERS[9].hp).toBeGreaterThan(UNIT_TIERS[0].hp);
  });

  it('parses unit chars into unit cells with tier and hp', () => {
    const g = parseLevel([UNIT_CHARS.join('')]);
    for (let t = 1; t <= 10; t++) {
      const i = idx(t - 1, ROWS - 1);
      expect(g.cells[i]).toBe(CELL.UNIT);
      expect(g.tier[i]).toBe(t);
      expect(g.hp[i]).toBe(UNIT_TIERS[t - 1].hp);
    }
  });
});

describe('unit behaviour', () => {
  it('drops bombs while playing, never while serving', () => {
    const w = world([[10, 5, unitChar(1)]]);
    w.state = 'ready';
    run(w, 12);
    expect(w.shells).toHaveLength(0);
    w.state = 'play';
    park(w); // no floor in this world, so the parked ball counts as inside
    run(w, UNIT_TIERS[0].interval * 2);
    expect(drainEvents(w).some((e) => e.t === 'fire-shell')).toBe(true);
  });

  it('units fire only while a ball is inside the wall (above the steel floor)', () => {
    const floor = 20; // text line of a steel floor with a hole at 30-31
    const p = [[10, 5, unitChar(3)], [20, 2, '#']];
    for (let c = 0; c < COLS; c++) if (c !== 30 && c !== 31) p.push([c, floor, 'S']);
    const w = world(p);
    addBall(w.balls, 5, 5, 30, 0, 0); // rallying below the floor: outside
    w.broken = 5;
    run(w, 15);
    expect(w.shells).toHaveLength(0);
    addBall(w.balls, 30, ROWS - 3, 30, 0, 0); // rallying above the floor: inside
    run(w, UNIT_TIERS[2].interval * 2);
    expect(drainEvents(w).some((e) => e.t === 'fire-shell')).toBe(true);
  });

  it('higher tiers fire more bombs per volley', () => {
    const w = world([[10, 5, unitChar(10)]]);
    park(w);
    w.units = w.units.map((u) => ({ ...u, cd: 0 }));
    run(w, 1 / 60);
    expect(w.shells.length).toBe(UNIT_TIERS[9].shots);
  });

  it('a bomb on the paddle stuns it: frozen and shrunk, then recovers', () => {
    const w = world([[0, 0, '#']]);
    park(w);
    setPaddleX(w, 20);
    w.shells = [{ x: 20, y: PADDLE_Y + 1, vx: 0, vy: -10, tier: 3 }];
    run(w, 0.2);
    expect(w.stun).toBeGreaterThan(0);
    expect(w.paddle.w).toBeLessThan(PADDLE_W);
    setPaddleX(w, 35);
    expect(w.paddle.x).toBe(20);
    expect(drainEvents(w).some((e) => e.t === 'paddle-hit')).toBe(true);
    run(w, UNIT_TIERS[2].stun + 0.1);
    expect(w.stun).toBe(0);
    expect(w.paddle.w).toBe(PADDLE_W);
    setPaddleX(w, 35);
    expect(w.paddle.x).toBe(35);
  });

  it('only top-tier bombs cost a life', () => {
    const low = world([[0, 0, '#']]);
    park(low);
    setPaddleX(low, 20);
    low.shells = [{ x: 20, y: PADDLE_Y + 1, vx: 0, vy: -10, tier: 9 }];
    run(low, 0.2);
    expect(low.lives).toBe(3);

    const high = world([[0, 0, '#']]);
    park(high);
    setPaddleX(high, 20);
    high.shells = [{ x: 20, y: PADDLE_Y + 1, vx: 0, vy: -10, tier: 10 }];
    run(high, 0.2);
    expect(high.lives).toBe(2);
  });

  it('a stunned paddle cannot be hit again until it recovers', () => {
    const w = world([[0, 0, '#']]);
    park(w);
    setPaddleX(w, 20);
    // Three lethal bombs arriving one right after another.
    w.shells = [0, 0.4, 0.8].map((dy) => ({ x: 20, y: PADDLE_Y + 1 + dy, vx: 0, vy: -10, tier: 10 }));
    run(w, 0.5);
    expect(w.lives).toBe(2); // only the first lethal bomb counts
    expect(drainEvents(w).filter((e) => e.t === 'paddle-hit')).toHaveLength(1);
  });

  it('a dodged bomb falls away harmlessly', () => {
    const w = world([[0, 0, '#']]);
    park(w);
    setPaddleX(w, 40);
    w.shells = [{ x: 5, y: PADDLE_Y + 1, vx: 0, vy: -10, tier: 10 }];
    run(w, 1);
    expect(w.shells).toHaveLength(0);
    expect(w.stun).toBe(0);
    expect(w.lives).toBe(3);
  });

  it('balls wear a unit down by its hp, then it stops firing', () => {
    const tier = 5;
    const w = world([[10, 2, unitChar(tier)], [0, 0, '#']]);
    const i = idx(10, topRow(2));
    park(w); // index 0 keeps the world alive; the striker is always index 1
    for (let k = 0; k < UNIT_TIERS[tier - 1].hp; k++) {
      expect(w.grid.cells[i]).toBe(CELL.UNIT);
      addBall(w.balls, 10.5, topRow(2) - 2, 0, 30, 0);
      run(w, 0.1);
      w.balls.n = 1;
    }
    expect(w.grid.cells[i]).toBe(CELL.EMPTY);
    const ev = drainEvents(w);
    expect(ev.some((e) => e.t === 'unit-down' && e.tier === tier)).toBe(true);
    // tier 5+ leaves a multiplier item behind
    expect(w.drops.length).toBe(1);
    w.shells = [];
    run(w, 10);
    expect(w.shells).toHaveLength(0);
  });

  it('losing every ball clears falling bombs', () => {
    const w = world([[0, 0, '#']]);
    setPaddleX(w, 40);
    addBall(w.balls, 5, 1.5, 0, -30, 0);
    w.shells = [{ x: 20, y: 40, vx: 0, vy: -10, tier: 1 }];
    run(w, 0.3);
    expect(w.state).toBe('ready');
    expect(w.shells).toHaveLength(0);
  });
});
