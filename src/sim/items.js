import { PADDLE_Y, PADDLE_H, DROP_CATCH, BALL_SPEED, BALL_R, RELEASE_DRAIN, FRUIT_GAIN } from './constants.js';
import { addBall } from './balls.js';
import { aimBall } from './cells.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

/** @returns {number} how much a fruit (identified by its ITEM_MULT) multiplies the swarm */
export const fruitGain = (mult) => mult * FRUIT_GAIN;

/**
 * Queues enough balls to multiply the current count by `mult` (capped by the
 * pool). They are released gradually by releaseQueued.
 * @returns {number} the ball count this catch is heading for
 */
export function multiplyBalls(w, mult) {
  const b = w.balls;
  const have = b.n + w.queued;
  const target = Math.min(b.cap, Math.round(Math.max(have, 1) * mult));
  w.queued += Math.max(0, target - have);
  return target;
}

/**
 * Releases queued balls quickly (a share of the queue per second). New balls are born where existing
 * balls are (preferring ones inside the wall), so the trapped swarm keeps swelling.
 */
export function releaseQueued(w, dt) {
  if (w.queued <= 0) return;
  w.releaseAcc += Math.max(w.releaseRate, w.queued * RELEASE_DRAIN) * dt;
  if (w.releaseAcc < 1) return;
  const b = w.balls;
  // Prefer parents inside the wall (above the sealed floor): a ball born
  // outside usually just drops away, so the swarm would not really grow.
  const line = w.grid.floorRow + 1;
  const inside = [];
  for (let i = 0; i < b.n; i++) if (b.y[i] > line) inside.push(i);
  while (w.releaseAcc >= 1 && w.queued > 0) {
    w.releaseAcc -= 1;
    w.queued--;
    const n0 = b.n;
    const ok = n0 === 0
      ? addBall(b, w.paddle.x, PADDLE_TOP + BALL_R + 0.01, 0, BALL_SPEED, 0)
      : addBall(b, 0, 0, 0, 0, 0);
    if (!ok) { w.queued = 0; break; }
    if (n0 > 0) {
      const src = inside.length ? inside[Math.floor(w.rng() * inside.length)] : Math.floor(w.rng() * n0);
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
    const y = d.y - w.dropSpeed * dt;
    const overPaddle = Math.abs(d.x - p.x) <= p.w / 2 + DROP_CATCH;
    if (y <= PADDLE_TOP + 0.6 && y >= PADDLE_Y - PADDLE_H && overPaddle) {
      const gain = fruitGain(d.mult);
      const n = multiplyBalls(w, gain);
      w.collected++;
      w.catchStreak++;
      w.bestStreak = Math.max(w.bestStreak, w.catchStreak);
      w.bestFruit = Math.max(w.bestFruit, d.mult);
      w.events.push({ t: 'collect', x: d.x, mult: d.mult, gain, n, streak: w.catchStreak });
    } else if (y < -1) {
      w.catchStreak = 0; // a dropped fruit breaks the catch combo
      w.events.push({ t: 'miss', x: d.x, mult: d.mult });
    } else {
      kept.push({ ...d, y });
    }
  }
  w.drops = kept;
}
