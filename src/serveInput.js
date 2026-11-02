import { AIM_MAX } from './sim/aim.js';

// The touch serve in two steps (owner, 2026-11-02; docs/plans/2026-11-02-two-step-serve):
//  1. place: drag anywhere and the paddle follows; lifting never fires, it moves on to aiming.
//  2. aim: press and drag sideways to turn the aim (half the screen width = AIM_MAX); lift to fire.
//     Pulling the finger down past CANCEL_PX and lifting there cancels (the angle stays).
// Mouse and keyboard keep their own way (aimInput.js): hover moves, click-drag aims, release fires.
// Positions here are screen px (y grows downward); the caller maps x to the paddle.

export const TAP_PX = 10; // finger travel below this is a tap (above Android's 8dp touch slop)
export const CANCEL_PX = 60; // pull down this far while aiming and lifting does not fire
export const REPRESS_MS = 250; // a press this soon after entering the aim step is ignored (no double-tap shot)

export const SERVE_START = Object.freeze({
  phase: 'place', id: null, x0: 0, y0: 0, base: 0, angle: 0, moved: false, cancel: false, aimAt: -Infinity,
});

/**
 * @param {object} s the serve state
 * @param {{ id:number, x:number, y:number, t:number }} p the pointer pressing (t in ms)
 * @returns {object} the new state (the same one when the press is ignored)
 */
export function serveDown(s, p) {
  if (s.id !== null) return s; // a second finger never takes over
  if (s.phase === 'aim' && p.t - s.aimAt < REPRESS_MS) return s;
  return { ...s, id: p.id, x0: p.x, y0: p.y, base: s.angle, moved: false, cancel: false };
}

/**
 * @param {object} s
 * @param {{ id:number, x:number, y:number }} p
 * @param {number} width screen width in px
 * @returns {{ state: object, movePaddle: boolean }} movePaddle: put the paddle under the finger
 */
export function serveMove(s, p, width) {
  if (s.id === null || p.id !== s.id) return { state: s, movePaddle: false };
  const moved = s.moved || Math.abs(p.x - s.x0) >= TAP_PX || Math.abs(p.y - s.y0) >= TAP_PX;
  if (s.phase === 'place') return { state: moved === s.moved ? s : { ...s, moved }, movePaddle: moved };
  const turn = ((p.x - s.x0) / (width / 2)) * AIM_MAX;
  const angle = Math.max(-AIM_MAX, Math.min(AIM_MAX, s.base + turn));
  return { state: { ...s, moved, angle, cancel: p.y - s.y0 >= CANCEL_PX }, movePaddle: false };
}

/**
 * @param {object} s
 * @param {{ id:number, x:number, y:number, t:number }} p
 * @returns {{ state: object, fire: number|null }} fire: the angle to serve at, or null for no shot
 */
export function serveUp(s, p) {
  if (s.id === null || p.id !== s.id) return { state: s, fire: null };
  if (s.phase === 'place') return { state: { ...s, phase: 'aim', id: null, aimAt: p.t }, fire: null };
  if (s.cancel) return { state: { ...s, id: null, cancel: false }, fire: null };
  return { state: SERVE_START, fire: s.angle };
}
