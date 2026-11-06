import { describe, it, expect } from 'vitest';
import { pipeLook } from '../src/render/pipeLook.js';
import { getLevel, parseLevel } from '../src/sim/levels.js';
import { COLS, CELL } from '../src/sim/constants.js';

// The pipe drawn as a trough (owner, 2026-11-07: "강철 블록 모양 → 홈통 모양"): its walls get their own
// rim look and its open cells a channel floor, so it no longer reads as plain steel blocks.
const lvl = getLevel(40);
const grid = parseLevel(lvl.lines, { brickHp: 1, box: lvl.box, holes: lvl.holes });
const xy = (i) => [i % COLS, Math.floor(i / COLS)];

describe('pipeLook', () => {
  const look = pipeLook(grid, lvl.pipe);

  it('no pipe, no trough', () => {
    expect(pipeLook(grid, null)).toEqual({ walls: [], floor: [] });
  });

  it('the rim is the steel right around the pipe, not the box floor', () => {
    expect(look.walls.length).toBeGreaterThan(50);
    for (const i of look.walls) {
      expect(grid.cells[i]).toBe(CELL.STEEL);
      const [x, y] = xy(i);
      expect(y).toBeGreaterThan(lvl.pipe.floor);
      expect(x > lvl.box.left && x < lvl.box.right && y < lvl.box.top, `box wall (${x}, ${y})`).toBe(true);
      let touches = false;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (lvl.pipe.cells.has((y + b) * 1024 + x + a)) touches = true;
      expect(touches, `wall (${x}, ${y})`).toBe(true);
    }
    expect(new Set(look.walls).size).toBe(look.walls.length);
  });

  it('the channel floor lies under every open pipe cell above the box floor', () => {
    const above = [...lvl.pipe.cells].filter((k) => Math.floor(k / 1024) > lvl.pipe.floor);
    expect(look.floor.length).toBe(above.length);
    for (const i of look.floor) expect(grid.cells[i]).toBe(CELL.EMPTY);
  });
});
