import { COLS, FEVER_STREAK, FEVER_TIME, FEVER_WIDEN, STUN_SHRINK } from './constants.js';

/** Paddle width right now: base, widened by fever, shrunk by a stun. */
export function paddleWidth(w) {
  return w.basePaddleW * (w.fever > 0 ? FEVER_WIDEN : 1) * (w.stun > 0 ? STUN_SHRINK : 1);
}

/** Applies the current width, keeping a paddle that grew against a wall inside the field. */
export function refreshPaddle(w) {
  const width = paddleWidth(w);
  const x = Math.max(width / 2, Math.min(COLS - width / 2, w.paddle.x));
  w.paddle = { ...w.paddle, w: width, x };
}

/**
 * Called after each catch: every FEVER_STREAK-th fruit in a row starts a fever.
 * A running fever is not renewed (the magnet makes misses rare, so it would never end).
 */
export function feverOnCatch(w) {
  if (w.fever > 0 || w.catchStreak === 0 || w.catchStreak % FEVER_STREAK !== 0) return;
  w.fevers++;
  w.fever = FEVER_TIME;
  refreshPaddle(w);
  w.events.push({ t: 'fever', streak: w.catchStreak });
}

export function updateFever(w, dt) {
  if (w.fever <= 0) return;
  w.fever = Math.max(0, w.fever - dt);
  if (w.fever === 0) endFever(w);
}

/** Stops the fever (timer ran out or a life was lost). */
export function endFever(w) {
  w.fever = 0;
  refreshPaddle(w);
  w.events.push({ t: 'fever-end' });
}
