import { PADDLE_Y, PADDLE_H, DROP_SPEED, DROP_CATCH, BALL_SPEED, BALL_R } from './constants.js';
import { addBall } from './balls.js';
import { aimBall } from './cells.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

/**
 * Multiplies the ball count by `mult` (capped by the pool). New balls are born
 * where existing balls are, so a ball trapped inside the wall bursts in place.
 */
export function multiplyBalls(w, mult) {
  const b = w.balls;
  const n0 = b.n;
  if (n0 === 0) {
    for (let k = 0; k < mult && addBall(b, w.paddle.x, PADDLE_TOP + BALL_R + 0.01, 0, BALL_SPEED, 0); k++) {
      aimBall(b, b.n - 1, (w.rng() - 0.5) * 2);
    }
    return b.n;
  }
  const target = n0 * mult;
  for (let k = n0; k < target; k++) {
    const src = k % n0;
    if (!addBall(b, b.x[src], b.y[src], 0, 0, 0)) break;
    b.lastCell[b.n - 1] = b.lastCell[src];
    aimBall(b, b.n - 1, w.rng() * Math.PI * 2);
  }
  return b.n;
}

/** Falls every item capsule; the paddle catches, the floor swallows. */
export function updateDrops(w, dt) {
  if (!w.drops.length) return;
  const p = w.paddle;
  const kept = [];
  for (const d of w.drops) {
    const y = d.y - DROP_SPEED * dt;
    const overPaddle = Math.abs(d.x - p.x) <= p.w / 2 + DROP_CATCH;
    if (y <= PADDLE_TOP + 0.4 && y >= PADDLE_Y - PADDLE_H && overPaddle) {
      const n = multiplyBalls(w, d.mult);
      w.collected++;
      w.events.push({ t: 'collect', x: d.x, mult: d.mult, n });
    } else if (y < -1) {
      w.events.push({ t: 'miss', x: d.x, mult: d.mult });
    } else {
      kept.push({ ...d, y });
    }
  }
  w.drops = kept;
}
