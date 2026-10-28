import { COLS, ROWS, CELL, BALL_R, BALL_SPEED, PADDLE_Y, PADDLE_H } from './constants.js';
import { aimBall, MIN_VY } from './cells.js';
import { isInside } from './box.js';

// The aim guide: where a serve at a given angle will fly, worked out with the
// same moves and wall bounces as the real ball (world.js moveBall), until it
// gets into the box, comes back down to the paddle, or reaches the ceiling
// (which kicks balls off at a random angle, so the guide stops there).

export const AIM_MAX = Math.acos(MIN_VY); // steepest aim a ball can fly (radians from straight up)
export const AIM_FAN = 0.04; // an aimed serve's three balls fly this close together (radians)
const STEP = 0.3; // cells per trace step (a real ball moves at most 0.4 per substep)
// A frame splits a ball's move into equal substeps of 0.25-0.4 cells depending on the frame rate
// (30-144 Hz): the guide only says "in" when the shot gets in at each of these step sizes.
const CHECK_STEPS = [0.25, 0.4];
const MAX_LENGTH = 320; // cells of flight the guide follows at most
// "In" means well in: inside the box for this many cells of flight in a row. A ball that just
// grazes the inner corner of a hole and bounces back out is never counted (the game checks once a frame).
const ENTER_DEPTH = 3;
const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

const solid = (w, c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && w.grid.cells[r * COLS + c] !== CELL.EMPTY;

/**
 * @param {object} w the world, ball waiting on the paddle
 * @param {number} angle radians from straight up (positive = right)
 * @returns {{ points: number[][], entered: boolean, end: 'enter'|'paddle'|'ceiling'|'far'|'unsure' }}
 *   points: the start, every bounce and the end, in field cells
 */
export function predictPath(w, angle) {
  const path = trace(w, angle, STEP);
  if (!path.entered || CHECK_STEPS.every((step) => trace(w, angle, step).entered)) return path;
  return { ...path, entered: false, end: 'unsure' };
}

/** One trace of the flight with a fixed step size (cells). */
function trace(w, angle, step) {
  const ball = { x: [w.paddle.x], y: [PADDLE_TOP + BALL_R + 0.01], vx: [0], vy: [BALL_SPEED] };
  aimBall(ball, 0, angle);
  let x = ball.x[0];
  let y = ball.y[0];
  let vx = ball.vx[0];
  let vy = ball.vy[0];
  const h = step / BALL_SPEED;
  const points = [[x, y]];
  const turn = () => points.push([x, y]);
  let inside = 0; // cells flown inside the box in a row
  for (let travelled = 0; travelled < MAX_LENGTH; travelled += step) {
    let nx = x + vx * h;
    if (nx < BALL_R) { nx = BALL_R; vx = Math.abs(vx); turn(); }
    else if (nx > COLS - BALL_R) { nx = COLS - BALL_R; vx = -Math.abs(vx); turn(); }
    else if (solid(w, Math.floor(nx + Math.sign(vx) * BALL_R), Math.floor(y))) { vx = -vx; nx = x; turn(); }
    x = nx;
    let ny = y + vy * h;
    if (ny > ROWS - BALL_R) { y = ROWS - BALL_R; turn(); return { points, entered: false, end: 'ceiling' }; }
    if (solid(w, Math.floor(x), Math.floor(ny + Math.sign(vy) * BALL_R))) { vy = -vy; ny = y; turn(); }
    y = ny;
    if (solid(w, Math.floor(x), Math.floor(y))) {
      vx = -vx;
      vy = -vy;
      x += vx * h;
      y += vy * h;
      turn();
    }
    inside = isInside(w.grid, x, y) ? inside + step : 0;
    if (inside >= ENTER_DEPTH) { points.push([x, y]); return { points, entered: true, end: 'enter' }; }
    if (vy < 0 && y - BALL_R <= PADDLE_TOP) { points.push([x, y]); return { points, entered: false, end: 'paddle' }; }
  }
  points.push([x, y]);
  return { points, entered: false, end: 'far' };
}
