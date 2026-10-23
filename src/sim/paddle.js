import { COLS, STUN_SHRINK } from './constants.js';

/** Paddle width right now: base, shrunk while stunned. */
export function paddleWidth(w) {
  return w.basePaddleW * (w.stun > 0 ? STUN_SHRINK : 1);
}

/** Applies the current width, keeping a paddle that grew against a wall inside the field. */
export function refreshPaddle(w) {
  const width = paddleWidth(w);
  const x = Math.max(width / 2, Math.min(COLS - width / 2, w.paddle.x));
  w.paddle = { ...w.paddle, w: width, x };
}
