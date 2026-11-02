import { ROWS } from './constants.js';
import { stageSlot } from './sequence.js';
import { mulberry32 } from './rng.js';

// The pipe stage (owner, 2026-11-02; docs/plans/2026-11-02-size-fullscreen-pipes): a steel pipe climbs
// from a floor hole and winds into the mural. Whether a ball gets through to the fruit past its far end
// or comes back out is plain physics (where it hit the paddle decides much of it): nothing is rolled
// or steered. Longer and more winding as stages rise (owner: "too short; very varied, many bends,
// hard to get in and likely to come back out"). Measured with scripts/pipe-trial.mjs and pipe-stages.mjs.
//
// A shape is a path of moves traced by a w x w head from the floor hole: U(p), D(own), L(eft), R(ight).
// Steel walls go round every open cell; the floor under the head is the mouth (as wide as the pipe:
// a narrower mouth traps balls); the last move opens into the mural.
export const SHAPES = Object.freeze({
  L: [['U', 16], ['R', 20]],
  Z: [['U', 10], ['R', 14], ['U', 12]],
  S: [['U', 8], ['R', 12], ['U', 8], ['L', 12], ['U', 8]],
  stairs: [['U', 5], ['R', 5], ['U', 5], ['R', 5], ['U', 5], ['R', 5], ['U', 5], ['R', 5], ['U', 6]],
  dip: [['U', 14], ['R', 10], ['D', 8], ['R', 10], ['U', 12]],
  zigzag: [['U', 6], ['R', 7], ['U', 6], ['L', 7], ['U', 6], ['R', 7], ['U', 6], ['L', 7], ['U', 6]],
  hook: [['U', 18], ['R', 14], ['D', 10], ['L', 6]],
  snake: [['U', 6], ['R', 18], ['U', 6], ['L', 18], ['U', 6], ['R', 18], ['U', 6]],
});
// Which shapes each stretch of stages draws from (0-based stage index from which it applies), ordered by
// the measured share of entering balls that get through (scripts/pipe-trial.mjs, 2026-11-02): L/Z 25-28%,
// S/hook 19-20%, dip 17-19%, snake/zigzag 12-15%, stairs 9%.
export const TIERS = Object.freeze([
  { from: 9, shapes: ['L', 'Z'] },
  { from: 30, shapes: ['S', 'hook'] },
  { from: 60, shapes: ['dip', 'snake', 'zigzag'] },
  { from: 100, shapes: ['zigzag', 'snake', 'stairs'] },
]);
export const PIPE_W = 2; // open cells across
export const PIPE_PATIENCE = 2; // seconds a ball rattles in the pipe before it turns (world.js pipePatience)
export const PIPE_TURN = (23 * Math.PI) / 180; // how far it turns: an angle no wall pattern repeats on
const FRUIT = /[ACDEIM]/; // fruit cells (one fine cell each)
const isBrick = (ch) => ch === '#' || (ch >= 'a' && ch <= 'h');
const STEP = { U: [0, 1], D: [0, -1], L: [-1, 0], R: [1, 0] };
const FLIP = { U: 'U', D: 'D', L: 'R', R: 'L' };
const key = (x, y) => y * 1024 + x;

/** @param {number} n stage index (0-based) @returns {boolean} the stage gets a pipe (if its floor hole has room) */
export const pipeStage = (n) => n >= TIERS[0].from && !stageSlot(n).boss;

/** @param {number} n stage index @returns {string[]} the shapes stage n may use, best first (deterministic) */
export function shapesFor(n) {
  const tier = [...TIERS].reverse().find((t) => n >= t.from) ?? TIERS[0];
  const rng = mulberry32(n * 31 + 7);
  const list = [...tier.shapes];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

/**
 * Traces a path of moves from the floor hole. @returns {{ open: number[][], head: number[], dir: string }}
 */
function trace(moves, hx, floor, w) {
  let x = hx - Math.floor(w / 2);
  let y = floor;
  const open = [];
  const add = () => { for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) open.push([x + i, y + j]); };
  add();
  for (const [d, n] of moves) {
    const [dx, dy] = STEP[d];
    for (let k = 0; k < n; k++) { x += dx; y += dy; add(); }
  }
  return { open, head: [x, y], dir: moves[moves.length - 1][0] };
}

/**
 * Carves a pipe of `moves` above a floor hole, or returns null when it does not fit (box walls, other
 * holes). Fruit the pipe cuts away move to the plain bricks just past its far end (the vault).
 * @param {string[]} lines stage rows, top first
 * @param {{left:number,right:number,top:number}} box
 * @param {{ cells: number[][] }} hole the floor hole
 * @param {Array<[string, number]>} moves the path (SHAPES entries)
 * @param {{ others?: Array<{cells:number[][]}>, w?: number, name?: string }} [opts]
 * @returns {{ lines: string[], pipe: object }|null}
 */
export function carvePipe(lines, box, hole, moves, { others = [], w = PIPE_W, name = '' } = {}) {
  const [hx, floor] = hole.cells[0];
  const { open, head, dir } = trace(moves, hx, floor, w);
  const inside = (x, y) => x > box.left && x < box.right && y > floor && y < box.top;
  const near = (x, y) => others.some((h) => h.cells.some(([c, r]) => Math.abs(c - x) <= 3 && Math.abs(r - y) <= 3));
  const openSet = new Set(open.map(([x, y]) => key(x, y)));
  for (const [x, y] of open) if ((y !== floor && !inside(x, y)) || near(x, y)) return null;
  // Past the far end: the cells the pipe opens onto (never walled), and where its fruit go.
  const [dx, dy] = STEP[dir];
  const exit = new Set();
  for (let s = 1; s <= 2; s++) for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) exit.add(key(head[0] + i + dx * s, head[1] + j + dy * s));
  const [ex, ey] = [head[0] + dx * (w + 1), head[1] + dy * (w + 1)];
  if (!inside(ex, ey)) return null; // the far end must open onto the mural, not the box wall
  const rows = lines.map((l) => [...l]);
  const at = (x, y) => rows[ROWS - 1 - y][x];
  const lost = [];
  const put = (x, y, ch) => { if (FRUIT.test(at(x, y))) lost.push(at(x, y)); rows[ROWS - 1 - y][x] = ch; };
  for (const [x, y] of open) put(x, y, '.');
  for (const [x, y] of open) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const [nx, ny] = [x + i, y + j];
        const k = key(nx, ny);
        if (openSet.has(k) || exit.has(k) || ny <= floor || !inside(nx, ny)) continue;
        put(nx, ny, 'S');
      }
    }
  }
  // The vault: the fruit the pipe cut away go to the plain bricks nearest past its far end (however far,
  // so the stage keeps every fruit).
  if (lost.length) {
    const spots = [];
    for (let y = floor + 1; y < box.top; y++) {
      for (let x = box.left + 1; x < box.right; x++) {
        if (isBrick(at(x, y)) && !openSet.has(key(x, y))) spots.push([Math.hypot(x - ex, y - ey), x, y]);
      }
    }
    spots.sort((a, b) => a[0] - b[0]);
    lost.forEach((ch, i) => { if (spots[i]) rows[ROWS - 1 - spots[i][2]][spots[i][1]] = ch; });
  }
  const end = new Set();
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) end.add(key(head[0] + i, head[1] + j));
  return { lines: rows.map((r) => r.join('')), pipe: Object.freeze({ name, w, floor, mouth: hx, cells: openSet, end, length: open.length / (w * w) }) };
}

/**
 * The pipe for stage n: its shapes in turn, each also mirrored, the first that fits; else null.
 * @returns {{ lines: string[], pipe: object }|null}
 */
export function pipeFor(n, lines, box, holes) {
  const hole = holes.find((h) => h.side === 'bottom');
  if (!hole || !pipeStage(n)) return null;
  const others = holes.filter((h) => h !== hole);
  const flipFirst = mulberry32(n * 53 + 11)() < 0.5;
  for (const name of shapesFor(n)) {
    const base = SHAPES[name];
    const mirrored = base.map(([d, k]) => [FLIP[d], k]);
    for (const moves of flipFirst ? [mirrored, base] : [base, mirrored]) {
      const made = carvePipe(lines, box, hole, moves, { others, name });
      if (made) return made;
    }
  }
  return null;
}

/** @returns {boolean} (x, y) is in the pipe's open cells (the mouth row included) */
export function inPipe(pipe, x, y) {
  return Boolean(pipe) && pipe.cells.has(key(Math.floor(x), Math.floor(y)));
}

/** @returns {boolean} (x, y) is in the pipe's last cells, where it opens onto the mural */
export function atPipeEnd(pipe, x, y) {
  return Boolean(pipe) && pipe.end.has(key(Math.floor(x), Math.floor(y)));
}
