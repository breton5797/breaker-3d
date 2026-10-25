// Entrance odds of every hole slot on its own (one hole, both sizes), to rank
// slots from easy to hard. Usage: node scripts/slot-odds.mjs [trials]
import { getLevel, SLOTS } from '../src/sim/levels.js';
import { createWorld, stepWorld } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { aimBall } from '../src/sim/cells.js';
import { isInside } from '../src/sim/box.js';
import { mulberry32 } from '../src/sim/rng.js';
import { COLS, PADDLE_Y, PADDLE_H, BALL_R, BALL_SPEED, PADDLE_MAX_ANGLE } from '../src/sim/constants.js';

const TRIALS = Number(process.argv[2] ?? 3000);
const DT = 1 / 240;

function odds(stage, slot) {
  const lvl = getLevel(stage, { slots: [slot] });
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
      if (w.balls.vy[0] < 0 && w.balls.y[0] < PADDLE_Y + 2) break; // back at the paddle: missed
    }
    w.events = [];
  }
  return (100 * entered) / TRIALS;
}

for (const { slot } of SLOTS) {
  console.log(`${slot.padEnd(9)} size2: ${odds(0, slot).toFixed(2)}%  size1: ${odds(150, slot).toFixed(2)}%`);
}
