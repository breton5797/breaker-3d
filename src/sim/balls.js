import { MAX_BALLS } from './constants.js';

/**
 * Struct-of-arrays ball pool. Thousands of balls are updated every frame,
 * so this is the one place we mutate in place instead of copying.
 * @param {number} [cap]
 */
export function createBalls(cap = MAX_BALLS) {
  return {
    cap,
    n: 0,
    x: new Float32Array(cap),
    y: new Float32Array(cap),
    vx: new Float32Array(cap),
    vy: new Float32Array(cap),
    fire: new Float32Array(cap), // seconds of fire left
    lastCell: new Int32Array(cap), // last gate passed, so a gate fires once per pass
  };
}

/** @returns {boolean} false when the pool is full */
export function addBall(b, x, y, vx, vy, fire = 0) {
  if (b.n >= b.cap) return false;
  const i = b.n++;
  b.x[i] = x;
  b.y[i] = y;
  b.vx[i] = vx;
  b.vy[i] = vy;
  b.fire[i] = fire;
  b.lastCell[i] = -1;
  return true;
}

/** Swap-remove; caller must not advance its loop index after removal. */
export function removeBall(b, i) {
  const last = --b.n;
  if (i === last) return;
  b.x[i] = b.x[last];
  b.y[i] = b.y[last];
  b.vx[i] = b.vx[last];
  b.vy[i] = b.vy[last];
  b.fire[i] = b.fire[last];
  b.lastCell[i] = b.lastCell[last];
}
