// Measures how hard each stage's entrances are: the share of random serves
// (random paddle spot, random angle) that end up inside the landmark's box
// before coming back down to the paddle.
// Usage: node scripts/entry-odds.mjs [stage,stage,...] [trials]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld } from '../src/sim/world.js';
import { addBall } from '../src/sim/balls.js';
import { aimBall } from '../src/sim/cells.js';
import { isInside } from '../src/sim/box.js';
import { mulberry32 } from '../src/sim/rng.js';
import { COLS, PADDLE_Y, PADDLE_H, BALL_R, BALL_SPEED, PADDLE_MAX_ANGLE } from '../src/sim/constants.js';

const STAGES = process.argv[2]
  ? process.argv[2].split(',').map(Number)
  : [1, 11, 21, 31, 41, 61, 81, 101, 121, 141, 161, 181, 200];
const TRIALS = Number(process.argv[3] ?? 2000);
const DT = 1 / 240;

for (const stage of STAGES) {
  const lvl = getLevel(stage - 1);
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, brickHp: lvl.params.brickHp, rng: mulberry32(stage) });
  w.units = [];
  const rng = mulberry32(stage * 31);
  let entered = 0;
  for (let k = 0; k < TRIALS; k++) {
    w.state = 'play';
    w.balls.n = 0;
    w.drops = [];
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
  const p = lvl.params;
  const sides = lvl.holes.map((h) => h.side).join(',');
  console.log(`${String(stage).padStart(3)} holes=${p.holeCount}x${p.holeSize} [${sides}]  random serve gets in: ${((100 * entered) / TRIALS).toFixed(1)}%`);
}
