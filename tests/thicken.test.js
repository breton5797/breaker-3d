import { describe, it, expect } from 'vitest';
import { thicken, getLevel } from '../src/sim/levels.js';
import { createWorld } from '../src/sim/world.js';
import { stageSlot } from '../src/sim/sequence.js';

describe('murals are drawn with thicker outlines (more bricks)', () => {
  it('grows a brick into the open cells beside it, in its own colour', () => {
    expect(thicken(['.....', '..d..', '.....'])).toEqual(['..d..', '.ddd.', '..d..']);
  });

  it('keeps every original cell as it was', () => {
    const before = ['..e..', '.S.d.', 'c..#.'];
    const after = thicken(before);
    for (let y = 0; y < before.length; y++) {
      for (let x = 0; x < before[y].length; x++) if (before[y][x] !== '.') expect(after[y][x]).toBe(before[y][x]);
    }
  });

  it('only plain bricks spread: steel and special blocks stay single', () => {
    expect(thicken(['...', '.S.', '...'])).toEqual(['...', '.S.', '...']);
    expect(thicken(['...', '.B.', '...'])).toEqual(['...', '.B.', '...']);
  });

  it('regular stages carry clearly more bricks than before (avg 2,904 over the first lap)', () => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 40; i++) {
      if (stageSlot(i).boss) continue;
      const lvl = getLevel(i);
      sum += createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes }).grid.remaining;
      n++;
    }
    const avg = sum / n;
    expect(avg).toBeGreaterThan(2904 * 1.15);
    expect(avg).toBeLessThan(2904 * 1.45); // "a bit more", not a wall
  });
});
