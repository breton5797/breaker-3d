// How reachable each hole slot is for a given side-lane width.
// For one one-ball hole at a time: the % of random serves that get in (what an
// unaimed serve or the bot sees), and the % of aims (paddle spot x angle) the
// aim guide shows going in (what a player who aims can pick from).
// Usage: node scripts/lane-odds.mjs [trials] [stage]
import { getLevel, SLOTS } from '../src/sim/levels.js';
import { createWorld, stepWorld, setPaddleX } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { aimBall } from '../src/sim/cells.js';
import { isInside } from '../src/sim/box.js';
import { mulberry32 } from '../src/sim/rng.js';
import { predictPath, AIM_MAX } from '../src/sim/aim.js';
import { COLS, PADDLE_Y, PADDLE_H, BALL_R, BALL_SPEED, PADDLE_MAX_ANGLE, PADDLE_W } from '../src/sim/constants.js';

const TRIALS = Number(process.argv[2] ?? 1500);
const STAGE = Number(process.argv[3] ?? 150); // a one-ball-hole stage
const DT = 1 / 240;

function randomOdds(lvl) {
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, rng: mulberry32(1) });
  w.units = [];
  const rng = mulberry32(99);
  let entered = 0;
  for (let k = 0; k < TRIALS; k++) {
    w.state = 'play';
    w.balls.n = 0;
    addBall(w.balls, BALL_R + rng() * (COLS - 2 * BALL_R), PADDLE_Y + PADDLE_H / 2 + BALL_R + 0.01, 0, BALL_SPEED, 0);
    aimBall(w.balls, 0, (rng() * 2 - 1) * PADDLE_MAX_ANGLE);
    for (let t = 0; t < 10; t += DT) {
      stepWorld(w, DT);
      if (w.balls.n === 0) break;
      if (isInside(w.grid, w.balls.x[0], w.balls.y[0])) { entered++; break; }
      if (w.balls.vy[0] < 0 && w.balls.y[0] < PADDLE_Y + 2) break;
    }
    w.events = [];
  }
  return (100 * entered) / TRIALS;
}

function aimOdds(lvl) {
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, rng: mulberry32(1) });
  let ok = 0;
  let all = 0;
  for (let x = PADDLE_W / 2; x <= COLS - PADDLE_W / 2; x += 1) {
    setPaddleX(w, x);
    for (let a = -AIM_MAX; a <= AIM_MAX; a += 0.01) {
      all++;
      if (predictPath(w, a).entered) ok++;
    }
  }
  return (100 * ok) / all;
}

for (const lane of [1, 2, 7]) {
  console.log(`lane ${lane}`);
  for (const { slot } of SLOTS) {
    const lvl = getLevel(STAGE, { slots: [slot], lane });
    console.log(`  ${slot.padEnd(9)} random ${randomOdds(lvl).toFixed(2).padStart(5)}%   aim ${aimOdds(lvl).toFixed(2).padStart(5)}%`);
  }
}
