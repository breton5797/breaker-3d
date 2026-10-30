import { PADDLE_Y, PADDLE_H, DROP_CATCH, BALL_SPEED, BALL_R, RELEASE_DRAIN, FRUIT_GAINS, COIN_VALUE, BEAM_SHARE, OVERFLOW_SCORE, COIN_FALL } from './constants.js';
import { beamBoss } from './boss.js';
import { addBall } from './balls.js';
import { aimBall } from './cells.js';
import { isInside } from './box.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

/** @returns {number} how much a fruit (identified by its ITEM_MULT) multiplies the swarm */
export const fruitGain = (mult) => FRUIT_GAINS[mult] ?? 2;

/**
 * Queues enough balls to multiply the current count by `mult` (capped by the
 * pool). They are released gradually by releaseQueued.
 * @returns {number} the ball count this catch is heading for
 */
export function multiplyBalls(w, mult) {
  const b = w.balls;
  const have = b.n + w.queued;
  const wanted = Math.round(Math.max(have, 1) * mult);
  const target = Math.min(b.cap, wanted);
  w.queued += Math.max(0, target - have);
  // At the cap the extra balls can't exist: they become score instead of nothing.
  w.overflow = Math.max(0, wanted - Math.max(target, have));
  w.score += w.overflow * OVERFLOW_SCORE;
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
  // Prefer parents inside the box: a ball born outside usually just drops
  // away, so the swarm would not really grow.
  const inside = [];
  for (let i = 0; i < b.n; i++) if (isInside(w.grid, b.x[i], b.y[i])) inside.push(i);
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

/** Falls every gold coin; the paddle banks it as gold, a miss is simply lost. */
function updateCoins(w, dt) {
  if (!w.coins.length) return;
  const p = w.paddle;
  const kept = [];
  for (const coin of w.coins) {
    const y = coin.y - w.dropSpeed * COIN_FALL * dt; // slower than the fruit, so both can be caught
    if (y <= PADDLE_TOP + 0.6 && y >= PADDLE_Y - PADDLE_H && Math.abs(coin.x - p.x) <= p.w / 2 + DROP_CATCH) {
      w.gold += COIN_VALUE;
      w.events.push({ t: 'coin', x: coin.x, gold: COIN_VALUE, total: w.gold });
    } else if (y >= -1) {
      kept.push({ ...coin, y });
    }
  }
  w.coins = kept;
}

/** Falls every item capsule; the paddle catches, the floor swallows. */
export function updateDrops(w, dt) {
  releaseQueued(w, dt);
  updateCoins(w, dt);
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
      w.events.push({ t: 'collect', x: d.x, mult: d.mult, gain, n, streak: w.catchStreak, overflow: w.overflow });
      if (w.boss?.alive && w.finale) beamBoss(w, Math.max(1, Math.round(w.boss.hpMax * BEAM_SHARE * gain)));
    } else if (y < -1) {
      if (!w.finale) w.catchStreak = 0; // a dropped fruit breaks the catch combo (not in the finale: they all fall at once)
      w.events.push({ t: 'miss', x: d.x, mult: d.mult, finale: w.finale });
    } else {
      kept.push({ ...d, y });
    }
  }
  w.drops = kept;
}
