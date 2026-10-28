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
const MAX_LENGTH = 320; // cells of flight the guide follows at most
const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

const solid = (w, c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && w.grid.cells[r * COLS + c] !== CELL.EMPTY;

/**
 * @param {object} w the world, ball waiting on the paddle
 * @param {number} angle radians from straight up (positive = right)
 * @returns {{ points: number[][], entered: boolean, end: 'enter'|'paddle'|'ceiling'|'far' }}
 *   points: the start, every bounce and the end, in field cells
 */
export function predictPath(w, angle) {
  const ball = { x: [w.paddle.x], y: [PADDLE_TOP + BALL_R + 0.01], vx: [0], vy: [BALL_SPEED] };
  aimBall(ball, 0, angle);
  let x = ball.x[0];
  let y = ball.y[0];
  let vx = ball.vx[0];
  let vy = ball.vy[0];
  const h = STEP / BALL_SPEED;
  const points = [[x, y]];
  const turn = () => points.push([x, y]);
  for (let travelled = 0; travelled < MAX_LENGTH; travelled += STEP) {
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
    if (isInside(w.grid, x, y)) { points.push([x, y]); return { points, entered: true, end: 'enter' }; }
    if (vy < 0 && y - BALL_R <= PADDLE_TOP) { points.push([x, y]); return { points, entered: false, end: 'paddle' }; }
  }
  points.push([x, y]);
  return { points, entered: false, end: 'far' };
}
