import { PADDLE_Y, PADDLE_H, BALL_R } from './sim/constants.js';
import { AIM_MAX } from './sim/aim.js';

// Serving by touch: down at the paddle the finger moves it; a little above it the
// finger points the aim (the guide swings toward it and the paddle stays put).
// Moving back down keeps the chosen angle, so you can line the paddle up after aiming.

export const AIM_LIFT = 3; // rows above the paddle where the finger starts pointing the aim
const BALL_Y = PADDLE_Y + PADDLE_H / 2 + BALL_R;

/**
 * @param {{ x:number, y:number, paddleX:number }} p the finger on the board (x true, paddleX with finger reach)
 * @param {number} paddleX where the paddle is now
 * @param {number} angle the aim so far (radians from straight up)
 * @returns {{ angle:number, paddleX:number|null }} the new aim, and where to move the paddle (null: leave it)
 */
export function aimStep(p, paddleX, angle) {
  if (p.y > PADDLE_Y + AIM_LIFT) {
    const toward = Math.atan2(p.x - paddleX, Math.max(0.01, p.y - BALL_Y));
    return { angle: Math.max(-AIM_MAX, Math.min(AIM_MAX, toward)), paddleX: null };
  }
  return { angle, paddleX: p.paddleX };
}

/**
 * @param {number} angle radians from straight up
 * @param {boolean} held a finger is aiming right now
 * @returns {string} the hint over the paddle
 */
export function aimLabel(angle, held) {
  if (!held) return '누른 채 위로 끌면 각도 조절 · 떼면 발사';
  const deg = Math.round((Math.abs(angle) * 180) / Math.PI);
  if (deg === 0) return '수직 · 손을 떼면 발사';
  return `${angle < 0 ? `◀ ${deg}°` : `${deg}° ▶`} · 손을 떼면 발사`;
}
