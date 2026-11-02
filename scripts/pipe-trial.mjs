// Pipe test (docs/plans/2026-11-02-size-fullscreen-pipes, C1): a steel pipe from a floor hole up
// into the mural. Balls come up off the paddle at a known hit position; of those that get into the
// pipe, how many reach its far end (the fruit), how many come back out, how many get stuck.
// Nothing here is in the game yet: it only measures whether the idea passes the judge's gates.
// Usage: node scripts/pipe-trial.mjs [trials=20000] [stage=41]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { aimBall } from '../src/sim/cells.js';
import { mulberry32 } from '../src/sim/rng.js';
import { ROWS, PADDLE_Y, PADDLE_H, BALL_R, BALL_SPEED, PADDLE_MAX_ANGLE } from '../src/sim/constants.js';

const TRIALS = Number(process.argv[2] ?? 20000);
const STAGE = Number(process.argv[3] ?? 41);
const W = 3; // open cells across the pipe
const STUCK = 10; // seconds inside the pipe that count as stuck

/** Sets one fine cell (x, row y) in the stage lines. */
function put(rows, x, y, ch) { rows[ROWS - 1 - y][x] = ch; }

/**
 * Carves a pipe above the floor hole at (hx, floor): straight up (I), or up then right (L).
 * @returns {{ lines: string[], end: (x:number, y:number) => boolean, inPipe: (x:number, y:number) => boolean }}
 */
export function carve(lines, hx, floor, shape) {
  const rows = lines.map((l) => [...l]);
  const x0 = hx - 1; // open columns x0..x0+W-1, walls at x0-1 and x0+W
  const y0 = floor + 1;
  const UP = shape === 'I' ? 26 : 14; // rows the vertical part climbs
  const RUN = 16; // cells the L's sideways part runs
  const open = [];
  // The mouth is as wide as the pipe: with only the 1-cell floor hole open, a ball coming back down
  // mostly hit the steel beside it and could loop forever between the floor, the cap and the walls.
  for (let x = x0; x < x0 + W; x++) put(rows, x, floor, '.');
  for (let y = y0; y < y0 + UP; y++) {
    for (let x = x0; x < x0 + W; x++) { put(rows, x, y, '.'); open.push([x, y]); }
    put(rows, x0 - 1, y, 'S');
    if (shape === 'I' || y < y0 + UP - W) put(rows, x0 + W, y, 'S'); // the L's right wall stops where the turn opens
  }
  if (shape === 'L') {
    const top = y0 + UP; // cap over the vertical part and the roof of the sideways part
    for (let x = x0 - 1; x <= x0 + W + RUN; x++) put(rows, x, top, 'S');
    for (let x = x0 + W; x < x0 + W + RUN; x++) {
      for (let y = top - W; y < top; y++) { put(rows, x, y, '.'); open.push([x, y]); }
      put(rows, x, top - W - 1, 'S'); // floor of the sideways part
    }
  }
  // Through = reached the pipe's last cell: past it the ball breaks into the mural (the fruit) and,
  // a brick being in the way, usually bounces straight back down: that is still a success.
  const endI = (x, y) => y >= y0 + UP - 1;
  const endL = (x, y) => x >= x0 + W + RUN - 1;
  const inPipe = (x, y) => x >= x0 - 0.5 && y >= y0 - 0.5 && y <= y0 + UP + 0.5 && x <= (shape === 'L' ? x0 + W + RUN : x0 + W) + 0.5;
  return { lines: rows.map((r) => r.join('')), end: shape === 'I' ? endI : endL, inPipe };
}

/** One ball off the paddle at hit offset `off` (-1..1), stepped at `dt` until it settles. */
export function shoot(level, pipe, off, x, dt) {
  const w = createWorld(pipe.lines, { box: level.box, holes: level.holes, boss: null, rng: mulberry32(1) });
  w.state = 'play';
  w.balls.n = 0;
  addBall(w.balls, x, PADDLE_Y + PADDLE_H / 2 + BALL_R + 0.01, 0, BALL_SPEED, 0);
  aimBall(w.balls, 0, off * PADDLE_MAX_ANGLE, BALL_SPEED);
  let entered = false;
  let inside = 0;
  for (let t = 0; t < 20; t += dt) {
    stepWorld(w, dt);
    w.events = [];
    if (w.balls.n === 0) return entered ? 'back' : 'miss';
    const bx = w.balls.x[0];
    const by = w.balls.y[0];
    if (pipe.inPipe(bx, by)) { entered = true; inside += dt; }
    if (entered && pipe.end(bx, by)) return 'through';
    if (entered && by < level.box.bottom - 1) return 'back';
    if (!entered && w.balls.vy[0] < 0 && by < PADDLE_Y + 2) return 'miss';
    if (inside > STUCK) return 'stuck';
  }
  return entered ? 'stuck' : 'miss';
}

const level = getLevel(STAGE - 1);
const hole = level.holes.find((h) => h.side === 'bottom');
if (!hole) throw new Error(`stage ${STAGE} has no floor hole`);
const [hx, floor] = hole.cells[0];
console.log(`stage ${STAGE} (${level.name}), floor hole at x=${hx}, ${TRIALS} serves per run`);

for (const shape of ['I', 'L']) {
  const pipe = carve(level.lines, hx, floor, shape);
  for (const dt of [1 / 60, 1 / 120]) {
    const rng = mulberry32(42); // same serves at both frame rates
    const tally = { centre: { through: 0, back: 0, stuck: 0 }, edge: { through: 0, back: 0, stuck: 0 } };
    for (let i = 0; i < TRIALS; i++) {
      const off = rng() * 2 - 1;
      const x = hx + (rng() - 0.5) * 30; // paddle around the hole
      const r = shoot(level, pipe, off, x, dt);
      if (r === 'miss') continue;
      const bucket = Math.abs(off) < 0.4 ? 'centre' : 'edge';
      tally[bucket][r]++;
    }
    const rate = (b) => { const n = b.through + b.back + b.stuck; return n ? `${((100 * b.through) / n).toFixed(1)}% of ${n}` : '-'; };
    console.log(`${shape} @${Math.round(1 / dt)}Hz  centre hits: ${rate(tally.centre)}  edge hits: ${rate(tally.edge)}  stuck: ${tally.centre.stuck + tally.edge.stuck}`);
  }
}
