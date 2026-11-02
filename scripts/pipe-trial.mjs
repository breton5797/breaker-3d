// Pipe test (docs/plans/2026-11-02-size-fullscreen-pipes): each pipe shape (src/sim/pipes.js SHAPES) over
// a floor hole. Balls come up off the paddle at a known hit position; of those that get into the pipe,
// how many reach its far end (the fruit), come back out, or get stuck, at 60 and 120 Hz.
// Gates: nothing stuck; 60 vs 120 Hz within 3pp. Reported: how often a serve gets in, and through.
// Usage: node scripts/pipe-trial.mjs [trials=40000] [stage=41] [shape,shape,...]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { aimBall } from '../src/sim/cells.js';
import { mulberry32 } from '../src/sim/rng.js';
import { carvePipe, inPipe, atPipeEnd, SHAPES } from '../src/sim/pipes.js';
import { PADDLE_Y, PADDLE_H, BALL_R, BALL_SPEED, PADDLE_MAX_ANGLE } from '../src/sim/constants.js';

const TRIALS = Number(process.argv[2] ?? 40000);
const STAGE = Number(process.argv[3] ?? 41);
const NAMES = process.argv[4] ? process.argv[4].split(',') : Object.keys(SHAPES);
const STUCK = 15; // seconds inside the pipe that count as stuck (long pipes take a while)

/** One ball off the paddle at hit offset `off` (-1..1), stepped at `dt` until it settles. */
function shoot(level, lines, pipe, off, x, dt) {
  const w = createWorld(lines, { box: level.box, holes: level.holes, pipe, boss: null, rng: mulberry32(1) });
  w.state = 'play';
  w.balls.n = 0;
  addBall(w.balls, x, PADDLE_Y + PADDLE_H / 2 + BALL_R + 0.01, 0, BALL_SPEED, 0);
  aimBall(w.balls, 0, off * PADDLE_MAX_ANGLE, BALL_SPEED);
  let entered = false;
  let inside = 0;
  for (let t = 0; t < 30; t += dt) {
    stepWorld(w, dt);
    w.events = [];
    if (w.balls.n === 0) return entered ? 'back' : 'miss';
    const bx = w.balls.x[0];
    const by = w.balls.y[0];
    if (inPipe(pipe, bx, by)) { entered = true; inside += dt; }
    if (entered && atPipeEnd(pipe, bx, by)) return 'through';
    if (entered && by < level.box.bottom - 1) return 'back';
    if (!entered && w.balls.vy[0] < 0 && by < PADDLE_Y + 2) return 'miss';
    if (inside > STUCK) return 'stuck';
  }
  return entered ? 'stuck' : 'miss';
}

const level = getLevel(STAGE - 1, { pipe: false });
const hole = level.holes.find((h) => h.side === 'bottom');
if (!hole) throw new Error(`stage ${STAGE} has no floor hole`);
const hx = hole.cells[0][0];
console.log(`stage ${STAGE} (${level.name}), floor hole x=${hx}, ${TRIALS} serves per run; in = share of serves that get into the pipe`);
console.log('shape    Hz   in      through(centre)  through(edge)  through(all)  stuck');
for (const name of NAMES) {
  const made = carvePipe(level.lines, level.box, hole, SHAPES[name], { name });
  if (!made) { console.log(`${name.padEnd(7)}  (does not fit here)`); continue; }
  for (const dt of [1 / 60, 1 / 120]) {
    const rng = mulberry32(42); // same serves at both frame rates
    const t = { centre: { through: 0, n: 0 }, edge: { through: 0, n: 0 }, stuck: 0 };
    for (let i = 0; i < TRIALS; i++) {
      const off = rng() * 2 - 1;
      const x = hx + (rng() - 0.5) * 30; // paddle around the hole
      const r = shoot(level, made.lines, made.pipe, off, x, dt);
      if (r === 'miss') continue;
      if (r === 'stuck') t.stuck++;
      const b = t[Math.abs(off) < 0.4 ? 'centre' : 'edge'];
      b.n++;
      if (r === 'through') b.through++;
    }
    const pct = (a, n) => (n ? `${((100 * a) / n).toFixed(1)}%` : '-');
    const n = t.centre.n + t.edge.n;
    console.log(`${name.padEnd(7)} ${String(Math.round(1 / dt)).padStart(4)}  ${pct(n, TRIALS).padStart(5)}   ${pct(t.centre.through, t.centre.n).padStart(14)}  ${pct(t.edge.through, t.edge.n).padStart(13)}  ${pct(t.centre.through + t.edge.through, n).padStart(12)}  ${t.stuck}`);
  }
}
