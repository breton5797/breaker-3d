import { describe, it, expect } from 'vitest';
import { COLS, ROWS, BALL_R, BALL_SPEED, BALL_SPEED_INSIDE, DROP_SPEED, PADDLE_Y } from '../src/sim/constants.js';
import { getLevel } from '../src/sim/levels.js';

// Everything 10% bigger (owner, 2026-11-02; docs/plans/2026-11-02-size-fullscreen-pipes, A2):
// portrait screens fit the field's width, so the field gets fewer, bigger cells (96 -> 88 wide).
const OLD = { COLS: 96, ROWS: 128, BALL_SPEED: 54, BALL_SPEED_INSIDE: 72, DROP_SPEED: 16, approach: 26 };

describe('bigger cells', () => {
  it('a cell (and so the ball, bricks, holes, paddle) is at least 9% bigger on a width-limited screen', () => {
    expect(OLD.COLS / COLS).toBeGreaterThanOrEqual(1.09);
    expect((BALL_R / COLS) / (BALL_R / OLD.COLS)).toBeGreaterThanOrEqual(1.09);
  });

  it('the field keeps its shape (width : height within 1%), so the picture is not stretched', () => {
    expect(Math.abs(COLS / ROWS - OLD.COLS / OLD.ROWS)).toBeLessThan(0.0075);
  });

  it('balls and fruit cross the screen at the same pace as before (speeds scale with the cell count)', () => {
    const k = COLS / OLD.COLS;
    expect(BALL_SPEED / COLS).toBeCloseTo(OLD.BALL_SPEED / OLD.COLS, 2);
    expect(BALL_SPEED_INSIDE).toBeCloseTo(OLD.BALL_SPEED_INSIDE * k, 1);
    expect(DROP_SPEED).toBeCloseTo(OLD.DROP_SPEED * k, 1);
  });

  it('every mural still fits: box inside the field, at least 23 rows between the paddle and the box', () => {
    for (const n of [0, 1, 9, 10, 37, 99, 150, 199]) {
      const lvl = getLevel(n);
      expect(lvl.lines.length, `stage ${n + 1}`).toBeLessThan(ROWS);
      expect(lvl.lines.every((l) => l.length === COLS), `stage ${n + 1}`).toBe(true);
      expect(lvl.box.bottom - PADDLE_Y, `stage ${n + 1}`).toBeGreaterThanOrEqual(23);
      expect(lvl.box.right).toBeLessThan(COLS);
    }
  });

  it('the mural keeps its proportions when squeezed (box height : width within 3% of the 89 x 91 original on stage 1)', () => {
    const lvl = getLevel(0);
    const ratio = (lvl.box.top - lvl.box.bottom) / (lvl.box.right - lvl.box.left);
    expect(Math.abs(ratio - 89 / 91) / (89 / 91)).toBeLessThan(0.03);
  });
});
