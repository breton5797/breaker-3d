import { PADDLE_Y, PADDLE_H, DROP_SPEED, DROP_CATCH, BALL_SPEED, BALL_R } from './constants.js';
import { addBall } from './balls.js';
import { aimBall } from './cells.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

/**
 * Queues enough balls to multiply the current count by `mult` (capped by the
 * pool). They are released gradually by releaseQueued.
 * @returns {number} the ball count this catch is heading for
 */
export function multiplyBalls(w, mult) {
  const b = w.balls;
  const have = b.n + w.queued;
  const target = Math.min(b.cap, Math.max(have, 1) * mult);
  w.queued += Math.max(0, target - have);
  return target;
}

/**
 * Releases queued balls at the stage's release rate. New balls are born where existing
 * balls are, so a swarm trapped inside the wall keeps swelling in place.
 */
export function releaseQueued(w, dt) {
  if (w.queued <= 0) return;
  w.releaseAcc += w.releaseRate * dt;
  const b = w.balls;
  while (w.releaseAcc >= 1 && w.queued > 0) {
    w.releaseAcc -= 1;
    w.queued--;
    const n0 = b.n;
    const ok = n0 === 0
      ? addBall(b, w.paddle.x, PADDLE_TOP + BALL_R + 0.01, 0, BALL_SPEED, 0)
      : addBall(b, 0, 0, 0, 0, 0);
    if (!ok) { w.queued = 0; break; }
    if (n0 > 0) {
      const src = Math.floor(w.rng() * n0);
      b.x[b.n - 1] = b.x[src];
      b.y[b.n - 1] = b.y[src];
      b.lastCell[b.n - 1] = b.lastCell[src];
    }
    aimBall(b, b.n - 1, n0 === 0 ? (w.rng() - 0.5) * 2 : w.rng() * Math.PI * 2);
  }
  if (w.queued === 0) w.releaseAcc = 0;
}

/** Falls every item capsule; the paddle catches, the floor swallows. */
export function updateDrops(w, dt) {
  releaseQueued(w, dt);
  if (!w.drops.length) return;
  const p = w.paddle;
  const kept = [];
  for (const d of w.drops) {
    const y = d.y - DROP_SPEED * dt;
    const overPaddle = Math.abs(d.x - p.x) <= p.w / 2 + DROP_CATCH;
    if (y <= PADDLE_TOP + 0.6 && y >= PADDLE_Y - PADDLE_H && overPaddle) {
      const n = multiplyBalls(w, d.mult);
      w.collected++;
      w.catchStreak++;
      w.events.push({ t: 'collect', x: d.x, mult: d.mult, n, streak: w.catchStreak });
    } else if (y < -1) {
      w.catchStreak = 0; // a dropped fruit breaks the catch combo
      w.events.push({ t: 'miss', x: d.x, mult: d.mult });
    } else {
      kept.push({ ...d, y });
    }
  }
  w.drops = kept;
}
