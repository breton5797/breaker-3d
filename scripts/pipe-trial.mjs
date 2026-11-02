// Pipe test (docs/plans/2026-11-02-size-fullscreen-pipes): the game's L pipe (src/sim/pipes.js) over a
// floor hole. Balls come up off the paddle at a known hit position; of those that get into the pipe,
// how many reach its far end (the fruit), how many come back out, how many get stuck, at 60 and 120 Hz.
// Gates: centre vs edge hits differ by >= 20pp, 60 vs 120 Hz by <= 3pp, nothing stuck.
// (A straight pipe was measured too on 2026-11-02: every ball got through, no tension, so it was dropped.)
// Usage: node scripts/pipe-trial.mjs [trials=60000] [stage=41] [W] [UP] [RUN]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { aimBall } from '../src/sim/cells.js';
import { mulberry32 } from '../src/sim/rng.js';
import { carvePipe, inPipe, PIPE } from '../src/sim/pipes.js';
import { PADDLE_Y, PADDLE_H, BALL_R, BALL_SPEED, PADDLE_MAX_ANGLE } from '../src/sim/constants.js';

const [TRIALS = 60000, STAGE = 41, W = PIPE.W, UP = PIPE.UP, RUN = PIPE.RUN] = process.argv.slice(2).map(Number);
const STUCK = 10; // seconds inside the pipe that count as stuck

/** One ball off the paddle at hit offset `off` (-1..1), stepped at `dt` until it settles. */
function shoot(level, lines, pipe, off, x, dt) {
  const w = createWorld(lines, { box: level.box, holes: level.holes, pipe, boss: null, rng: mulberry32(1) });
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
    if (inPipe(pipe, bx, by)) { entered = true; inside += dt; }
    // Through = reached the bend's last column: past it the ball breaks into the mural (the fruit).
    if (entered && Math.floor(bx) === pipe.endX && Math.floor(by) >= pipe.top - pipe.w) return 'through';
    if (entered && by < level.box.bottom - 1) return 'back';
    if (!entered && w.balls.vy[0] < 0 && by < PADDLE_Y + 2) return 'miss';
    if (inside > STUCK) return 'stuck';
  }
  return entered ? 'stuck' : 'miss';
}

const level = getLevel(STAGE - 1);
const hole = level.holes.find((h) => h.side === 'bottom');
if (!hole) throw new Error(`stage ${STAGE} has no floor hole`);
const { lines, pipe } = carvePipe(level.lines, level.box, hole, { W, UP, RUN });
const hx = hole.cells[0][0];
console.log(`stage ${STAGE} (${level.name}), L pipe W=${W} UP=${UP} RUN=${RUN} over the floor hole at x=${hx}, ${TRIALS} serves per run`);
for (const dt of [1 / 60, 1 / 120]) {
  const rng = mulberry32(42); // same serves at both frame rates
  const tally = { centre: { through: 0, back: 0, stuck: 0 }, edge: { through: 0, back: 0, stuck: 0 } };
  for (let i = 0; i < TRIALS; i++) {
    const off = rng() * 2 - 1;
    const x = hx + (rng() - 0.5) * 30; // paddle around the hole
    const r = shoot(level, lines, pipe, off, x, dt);
    if (r !== 'miss') tally[Math.abs(off) < 0.4 ? 'centre' : 'edge'][r]++;
  }
  const rate = (b) => { const n = b.through + b.back + b.stuck; return n ? `${((100 * b.through) / n).toFixed(1)}% of ${n}` : '-'; };
  console.log(`@${Math.round(1 / dt)}Hz  centre hits: ${rate(tally.centre)}  edge hits: ${rate(tally.edge)}  stuck: ${tally.centre.stuck + tally.edge.stuck}`);
}
