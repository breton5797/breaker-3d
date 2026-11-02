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
// Pipe paths are generated, as long and twisted as the box allows (owner, 2026-11-02: "too short; twist
// them a lot and make them as long as possible"). Corridors of a path run GAP cells apart, so one steel
// wall always separates them.
const GAP = 3;
const up = (k) => ['U', k];

/** Back and forth across the box, a little higher each pass: `legs` passes of `len` cells. */
export function meander(legs, len) {
  const moves = [up(6)];
  for (let i = 0; i < legs; i++) moves.push([i % 2 ? 'L' : 'R', len], up(GAP));
  moves.push(up(4));
  return moves;
}

/** Up and down like the teeth of a comb, a step sideways between teeth: `teeth` teeth of `height` rows. */
export function comb(teeth, height) {
  const moves = [up(4)];
  for (let i = 0; i < teeth; i++) moves.push([i % 2 ? 'D' : 'U', height], ['R', GAP]);
  moves.push(up(height + 6));
  return moves;
}

/** A square spiral winding inward; its far end opens onto the bricks it encloses (the vault). */
export function spiral(size) {
  const moves = [up(4)];
  const dirs = ['R', 'U', 'L', 'D'];
  let len = size;
  for (let k = 0; len >= GAP + 2; k++) {
    moves.push([dirs[k % 4], len]);
    if (k % 2 === 1) len -= GAP; // each ring is GAP cells inside the last
  }
  return moves;
}

// Each stretch of stages (0-based index from which it applies): which generators, and the sizes tried
// from largest down (the longest that fits wins). Longer and more twisted as stages rise.
export const TIERS = Object.freeze([
  { from: 9, kinds: ['meander', 'comb'], meander: [[4, 24], [3, 20], [3, 14]], comb: [[6, 14], [4, 12], [4, 8]] },
  { from: 30, kinds: ['meander', 'comb', 'spiral'], meander: [[6, 26], [5, 22], [4, 16]], comb: [[8, 16], [6, 14], [5, 10]], spiral: [24, 20, 16] },
  { from: 60, kinds: ['meander', 'comb', 'spiral'], meander: [[8, 28], [7, 24], [6, 18]], comb: [[10, 18], [8, 16], [6, 12]], spiral: [30, 26, 22, 18] },
  { from: 100, kinds: ['spiral', 'meander', 'comb'], meander: [[11, 30], [9, 26], [8, 20]], comb: [[12, 20], [10, 18], [8, 14]], spiral: [36, 32, 28, 24, 20] },
]);
const MAKE = { meander, comb, spiral };

export const PIPE_W = 2; // open cells across
export const PIPE_PATIENCE = 2; // seconds a ball rattles in the pipe before it turns (world.js pipePatience)
export const PIPE_TURN = (23 * Math.PI) / 180; // how far it turns: an angle no wall pattern repeats on
export const PIPE_FLUSH = 40; // seconds in the pipe after which it sends the ball back out (world.js)

/** @returns {number[]|null} the way back toward the mouth from (x, y), or null outside the pipe */
export function wayBack(pipe, x, y) {
  return pipe?.back.get(key(Math.floor(x), Math.floor(y))) ?? null;
}
const isBrick = (ch) => ch === '#' || (ch >= 'a' && ch <= 'h');
// A special block the pipe cuts through (fruit, coin, enemy unit, bomb...) is kept: it moves to the vault.
const special = (ch) => ch !== '.' && ch !== 'S' && !isBrick(ch);
const STEP = { U: [0, 1], D: [0, -1], L: [-1, 0], R: [1, 0] };
const FLIP = { U: 'U', D: 'D', L: 'R', R: 'L' };
const key = (x, y) => y * 1024 + x;

/** @param {number} n stage index (0-based) @returns {boolean} the stage gets a pipe (if its floor hole has room) */
export const pipeStage = (n) => n >= TIERS[0].from && !stageSlot(n).boss;

/**
 * The pipe paths stage n tries, best first: its tier's kinds in a stage-seeded order, each from its
 * largest size down. Deterministic.
 * @returns {Array<{ name: string, moves: Array<[string, number]> }>}
 */
export function shapesFor(n) {
  const tier = [...TIERS].reverse().find((t) => n >= t.from) ?? TIERS[0];
  const rng = mulberry32(n * 31 + 7);
  const kinds = [...tier.kinds];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  // Largest first across kinds: every kind's biggest size, then every kind's next size...
  const out = [];
  const depth = Math.max(...kinds.map((k) => tier[k].length));
  for (let s = 0; s < depth; s++) {
    for (const kind of kinds) {
      const size = tier[kind][s];
      if (size === undefined) continue;
      const args = Array.isArray(size) ? size : [size];
      out.push({ name: `${kind}-${args.join('x')}`, moves: MAKE[kind](...args) });
    }
  }
  return out;
}

/** Puts fruit `chars` on the plain bricks nearest `point` (outside the pipe), in place. */
function placeNear(rows, box, floor, openSet, [px, py], chars) {
  if (!chars.length) return;
  const spots = [];
  for (let y = floor + 1; y < box.top; y++) {
    for (let x = box.left + 1; x < box.right; x++) {
      if (isBrick(rows[ROWS - 1 - y][x]) && !openSet?.has(key(x, y))) spots.push([Math.hypot(x - px, y - py), x, y]);
    }
  }
  spots.sort((a, b) => a[0] - b[0]);
  chars.forEach((ch, i) => { if (spots[i]) rows[ROWS - 1 - spots[i][2]][spots[i][1]] = ch; });
}

/**
 * Traces a path of moves from the floor hole. @returns {{ open: number[][], head: number[], dir: string }}
 */
function trace(moves, hx, floor, w) {
  let x = hx - Math.floor(w / 2);
  let y = floor;
  const open = [];
  const back = new Map(); // cell -> the way back toward the mouth (the first move that reached it, reversed)
  const add = (dx, dy) => {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < w; j++) {
        open.push([x + i, y + j]);
        if (!back.has(key(x + i, y + j))) back.set(key(x + i, y + j), [-dx, -dy]);
      }
    }
  };
  add(0, 1);
  for (const [d, n] of moves) {
    const [dx, dy] = STEP[d];
    for (let k = 0; k < n; k++) { x += dx; y += dy; add(dx, dy); }
  }
  return { open, back, head: [x, y], dir: moves[moves.length - 1][0] };
}

/**
 * Carves a pipe of `moves` above a floor hole, or returns null when it does not fit (box walls, other
 * holes). Fruit the pipe cuts away move to the plain bricks just past its far end (the vault).
 * @param {string[]} lines stage rows, top first
 * @param {{left:number,right:number,top:number}} box
 * @param {{ cells: number[][] }} hole the floor hole
 * @param {Array<[string, number]>} moves the path (meander, comb, spiral)
 * @param {{ others?: Array<{cells:number[][]}>, w?: number, name?: string, vault?: boolean }} [opts] vault: false
 *   leaves the cut-away fruit to the caller (`lost`, with the pipe's `exit` point)
 * @returns {{ lines: string[], pipe: object, lost: string[] }|null}
 */
export function carvePipe(lines, box, hole, moves, { others = [], w = PIPE_W, name = '', vault = true } = {}) {
  const [hx, floor] = hole.cells[0];
  const { open, back, head, dir } = trace(moves, hx, floor, w);
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
  const put = (x, y, ch) => { if (special(at(x, y))) lost.push(at(x, y)); rows[ROWS - 1 - y][x] = ch; };
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
  // The vault: the fruit the pipe cut away go to the plain bricks nearest past its far end (pipeFor may
  // send some to a bypass hole first).
  if (vault) placeNear(rows, box, floor, openSet, [ex, ey], lost);
  const end = new Set();
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) end.add(key(head[0] + i, head[1] + j));
  return {
    lines: rows.map((r) => r.join('')),
    pipe: Object.freeze({ name, w, floor, mouth: hx, cells: openSet, back, end, exit: [ex, ey], length: open.length / (w * w) }),
    lost: vault ? [] : lost,
  };
}

const HOLE_GAP = 10; // the pipe's own mouth keeps at least this far (cells) from the stage's holes

/**
 * The pipe for stage n, or null. It gets its own new mouth in the box floor, clear of the stage's holes:
 * every hole and the fruit near it stay as they were (the stage keeps its measured difficulty) and the
 * pipe is an extra, risky road to a vault. It takes the stage's shapes in turn, each also mirrored, at
 * the floor spots farthest from the holes first; the first that fits wins. (2026-11-02: a pipe on the
 * floor hole itself, even with a bypass hole beside it, cost the bot its first fruit on most runs.)
 * @returns {{ lines: string[], pipe: object, hole: object }|null} hole: the pipe's mouth (an entrance too)
 */
export function pipeFor(n, lines, box, holes) {
  if (!pipeStage(n) || !holes.some((h) => h.side === 'bottom')) return null;
  const floor = holes.find((h) => h.side === 'bottom').cells[0][1];
  const gap = (x) => Math.min(...holes.flatMap((h) => h.cells.map(([c]) => Math.abs(c - x))));
  const spots = [];
  for (let x = box.left + 4; x < box.right - 3; x++) if (gap(x) >= HOLE_GAP) spots.push(x);
  spots.sort((a, b) => gap(b) - gap(a) || a - b);
  spots.length = Math.min(spots.length, 24); // the farthest spots are enough (and keep stage building quick)
  const flipFirst = mulberry32(n * 53 + 11)() < 0.5;
  for (const { name, moves: base } of shapesFor(n)) {
    const mirrored = base.map(([d, k]) => [FLIP[d], k]);
    for (const moves of flipFirst ? [mirrored, base] : [base, mirrored]) {
      for (const x of spots) {
        const hole = { slot: 'pipe', side: 'bottom', size: 1, cells: [[x, floor]], inward: [0, 1] };
        const made = carvePipe(lines, box, hole, moves, { others: holes, name });
        if (made) return { lines: made.lines, pipe: made.pipe, hole };
      }
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
