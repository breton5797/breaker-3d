import { ROWS } from './constants.js';
import { stageSlot } from './sequence.js';

// The pipe stage (owner, 2026-11-02; docs/plans/2026-11-02-size-fullscreen-pipes): an L pipe of steel
// climbs from a floor hole and bends sideways into the mural. Whether a ball gets through to the fruit
// past its far end, or comes back out, is plain physics (where it hit the paddle decides most of it):
// nothing is rolled or steered. Measured with scripts/pipe-trial.mjs and scripts/pipe-stages.mjs.
// Tuned on 2026-11-02 for "a little more suspense" (owner): first fruit 1.04x the plain stage
// (target 1.0-1.3), centre vs edge paddle hits 18% vs 56% through, 0 stuck, 60/120 Hz within 2.1pp.
export const PIPE = Object.freeze({
  W: 2, // open cells across; the mouth in the floor is as wide (a narrower mouth traps balls)
  UP: 14, // rows the shaft climbs before the bend
  RUN: 16, // cells the bend then runs sideways
});
const FIRST = 9; // stage index (0-based) of the first pipe stage: stage 10
const LAST = 33; // ...and the last: stage 34
const FRUIT = /[ACDEIM]/; // fruit cells (one fine cell each)
const isBrick = (ch) => ch === '#' || (ch >= 'a' && ch <= 'h');

/** @param {number} n stage index (0-based) @returns {boolean} the stage gets a pipe on its floor hole (if it has room) */
export const pipeStage = (n) => n >= FIRST && n <= LAST && !stageSlot(n).boss;

/**
 * Carves an L pipe above a floor hole. Fruit the pipe cuts away move to the plain bricks just past its
 * far end (the vault), so the stage keeps every fruit.
 * @param {string[]} lines stage rows, top first
 * @param {{left:number,right:number}} box
 * @param {{ cells: number[][] }} hole a floor hole
 * @param {{ W:number, UP:number, RUN:number }} [shape] PIPE (other shapes: the tuning scripts)
 * @returns {{ lines: string[], pipe: object }|null} null when the bend would run into the box wall
 */
export function carvePipe(lines, box, hole, shape = PIPE) {
  const { W, UP, RUN } = shape;
  const [hx, floor] = hole.cells[0];
  const dir = hx - box.left > box.right - hx ? -1 : 1; // bend toward the roomier side
  const x0 = hx - 1; // shaft columns x0..x0+W-1
  const top = floor + 1 + UP; // the cap's row
  const side = dir > 0 ? x0 + W : x0 - 1; // the wall the bend opens through
  const far = dir > 0 ? x0 - 1 : x0 + W;
  const endX = side + dir * (RUN - 1); // the bend's last column
  if (endX <= box.left + 1 || endX >= box.right - 1) return null;
  const rows = lines.map((l) => [...l]);
  const at = (x, y) => rows[ROWS - 1 - y][x];
  const lost = [];
  const put = (x, y, ch) => { if (FRUIT.test(at(x, y))) lost.push(at(x, y)); rows[ROWS - 1 - y][x] = ch; };
  for (let x = x0; x < x0 + W; x++) put(x, floor, '.');
  for (let y = floor + 1; y < top; y++) {
    for (let x = x0; x < x0 + W; x++) put(x, y, '.');
    put(far, y, 'S');
    if (y < top - W) put(side, y, 'S');
  }
  for (let k = -1; k <= W + RUN; k++) put(x0 + (dir > 0 ? k : W - 1 - k), top, 'S'); // cap and roof
  for (let k = 0; k < RUN; k++) {
    const x = side + dir * k;
    for (let y = top - W; y < top; y++) put(x, y, '.');
    put(x, top - W - 1, 'S'); // floor of the sideways run
  }
  const spots = [];
  for (let y = top - W - 2; y <= top + 2; y++) {
    for (let k = 1; k <= 8; k++) {
      const x = endX + dir * k;
      if (x > box.left && x < box.right && isBrick(at(x, y))) spots.push([x, y]);
    }
  }
  lost.forEach((ch, i) => { if (spots[i]) rows[ROWS - 1 - spots[i][1]][spots[i][0]] = ch; });
  return { lines: rows.map((r) => r.join('')), pipe: Object.freeze({ x0, floor, top, dir, side, endX, w: W }) };
}

/** @returns {boolean} (x, y) is in the pipe's open cells (the mouth row included) */
export function inPipe(pipe, x, y) {
  if (!pipe) return false;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx >= pipe.x0 && cx < pipe.x0 + pipe.w && cy >= pipe.floor && cy < pipe.top) return true;
  const lo = Math.min(pipe.side, pipe.endX);
  const hi = Math.max(pipe.side, pipe.endX);
  return cy >= pipe.top - pipe.w && cy < pipe.top && cx >= lo && cx <= hi;
}
