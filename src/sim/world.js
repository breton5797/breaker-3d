import {
  COLS, ROWS, CELL, BALL_R, BALL_SPEED, MAX_SUBSTEP, PADDLE_Y, PADDLE_H, PADDLE_W,
  PADDLE_MAX_ANGLE, START_LIVES, METEOR_FIRE, METEOR_COUNT, LAUNCH_BALLS, FINALE_FRACTION, STALL_TIME, STALL_FRACTION,
} from './constants.js';
import { parseLevel } from './levels.js';
import { createBalls, addBall, removeBall } from './balls.js';
import { hitCell, processPending, splitBall, aimBall, startFinale } from './cells.js';
import { updateDrops } from './items.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;

/**
 * @param {string[]} lines level text
 * @param {{ rng?: () => number, lives?: number, charges?: {split:number, meteor:number} }} [opts]
 */
export function createWorld(lines, opts = {}) {
  return {
    grid: parseLevel(lines),
    balls: createBalls(),
    rng: opts.rng ?? Math.random,
    paddle: { x: COLS / 2, w: PADDLE_W, prevX: COLS / 2 },
    state: 'ready', // ready | play | clear | over
    lives: opts.lives ?? START_LIVES,
    drops: [], // falling multiplier items { x, y, mult }
    collected: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    broken: 0,
    peakBalls: 0,
    charges: { split: 2, meteor: 2, ...opts.charges },
    finale: false,
    lastBreak: 0,
    pending: [],
    events: [],
    time: 0,
  };
}

/** @returns {object[]} events since the last drain */
export function drainEvents(w) {
  const ev = w.events;
  w.events = [];
  return ev;
}

export function setPaddleX(w, x) {
  const half = w.paddle.w / 2;
  w.paddle = { ...w.paddle, x: Math.max(half, Math.min(COLS - half, x)) };
}

export function launch(w) {
  if (w.state !== 'ready') return false;
  const b = w.balls;
  b.n = 0;
  const drift = Math.max(-0.4, Math.min(0.4, (w.paddle.x - w.paddle.prevX) * 0.08)) + (w.rng() - 0.5) * 0.2;
  for (let k = 0; k < LAUNCH_BALLS; k++) {
    addBall(b, w.paddle.x, PADDLE_TOP + BALL_R + 0.01, 0, BALL_SPEED, 0);
    aimBall(b, k, drift + (k - (LAUNCH_BALLS - 1) / 2) * 0.28);
  }
  w.state = 'play';
  w.events.push({ t: 'launch' });
  return true;
}

/** @param {'split'|'meteor'} name */
export function useSkill(w, name) {
  if (w.charges[name] <= 0 || (w.state !== 'play' && w.state !== 'ready')) return false;
  const b = w.balls;
  if (name === 'split') {
    if (w.state !== 'play' || b.n === 0) return false;
    const n0 = b.n;
    for (let i = 0; i < n0; i++) splitBall(w, i, 3);
  } else {
    if (w.state === 'ready') b.n = 0;
    for (let k = 0; k < METEOR_COUNT; k++) {
      if (!addBall(b, w.paddle.x, PADDLE_TOP + BALL_R + 0.01, 0, 0, METEOR_FIRE)) break;
      aimBall(b, b.n - 1, ((k / (METEOR_COUNT - 1)) - 0.5) * 2 * 1.1);
    }
    w.state = 'play';
  }
  w.charges = { ...w.charges, [name]: w.charges[name] - 1 };
  w.events.push({ t: 'skill', name });
  return true;
}

function solid(w, c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  return w.grid.cells[r * COLS + c] !== CELL.EMPTY;
}

function bouncePaddle(w, i) {
  const b = w.balls;
  const p = w.paddle;
  if (b.vy[i] >= 0 || b.y[i] - BALL_R > PADDLE_TOP || b.y[i] < PADDLE_Y - PADDLE_H) return;
  if (Math.abs(b.x[i] - p.x) > p.w / 2 + BALL_R) return;
  let off = Math.max(-1, Math.min(1, (b.x[i] - p.x) / (p.w / 2)));
  // Never return a ball perfectly vertical: that can loop forever in a cleared column.
  if (Math.abs(off) < 0.08) off = w.rng() < 0.5 ? -0.08 : 0.08;
  aimBall(b, i, off * PADDLE_MAX_ANGLE, Math.hypot(b.vx[i], b.vy[i]));
  b.y[i] = PADDLE_TOP + BALL_R;
  if (w.events.length < 8000) w.events.push({ t: 'paddle', x: b.x[i] });
}

/** Moves ball i by h seconds, resolving x then y against walls and cells. */
function moveBall(w, i, h) {
  const b = w.balls;
  let nx = b.x[i] + b.vx[i] * h;
  if (nx < BALL_R) { nx = BALL_R; b.vx[i] = Math.abs(b.vx[i]); }
  else if (nx > COLS - BALL_R) { nx = COLS - BALL_R; b.vx[i] = -Math.abs(b.vx[i]); }
  else {
    const c = Math.floor(nx + Math.sign(b.vx[i]) * BALL_R);
    const r = Math.floor(b.y[i]);
    if (solid(w, c, r) && hitCell(w, c, r, i)) { b.vx[i] = -b.vx[i]; nx = b.x[i]; }
  }
  b.x[i] = nx;

  let ny = b.y[i] + b.vy[i] * h;
  if (ny > ROWS - BALL_R) { ny = ROWS - BALL_R; b.vy[i] = -Math.abs(b.vy[i]); }
  else {
    const c = Math.floor(b.x[i]);
    const r = Math.floor(ny + Math.sign(b.vy[i]) * BALL_R);
    if (solid(w, c, r) && hitCell(w, c, r, i)) { b.vy[i] = -b.vy[i]; ny = b.y[i]; }
  }
  b.y[i] = ny;

  // Diagonal entry into a corner cell: resolve by reversing both axes.
  const cc = Math.floor(b.x[i]);
  const cr = Math.floor(b.y[i]);
  if (solid(w, cc, cr) && hitCell(w, cc, cr, i)) {
    b.vx[i] = -b.vx[i];
    b.vy[i] = -b.vy[i];
    b.x[i] += b.vx[i] * h;
    b.y[i] += b.vy[i] * h;
  }
  if (b.lastCell[i] >= 0 && b.lastCell[i] !== Math.floor(b.y[i]) * COLS + Math.floor(b.x[i])) b.lastCell[i] = -1;
  bouncePaddle(w, i);
}

function updateBalls(w, dt) {
  const b = w.balls;
  for (let i = 0; i < b.n; ) {
    if (b.fire[i] > 0) b.fire[i] = Math.max(0, b.fire[i] - dt);
    const dist = Math.hypot(b.vx[i], b.vy[i]) * dt;
    const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
    for (let s = 0; s < steps; s++) moveBall(w, i, dt / steps);
    if (b.y[i] < -1) { removeBall(b, i); continue; }
    i++;
  }
}

export function stepWorld(w, dt) {
  if (w.state === 'clear' || w.state === 'over') return;
  w.time += dt;
  w.comboTimer -= dt;
  if (w.comboTimer <= 0) w.combo = 0;
  processPending(w);
  if (w.state === 'ready') w.lastBreak = w.time;
  if (w.state === 'play') {
    updateBalls(w, dt);
    updateDrops(w, dt);
    w.peakBalls = Math.max(w.peakBalls, w.balls.n);
  }
  const g = w.grid;
  const nearlyDone = g.total >= 100 && g.remaining <= g.total * FINALE_FRACTION;
  const stalled = g.remaining <= g.total * STALL_FRACTION && w.time - w.lastBreak > STALL_TIME;
  if (!w.finale && w.state === 'play' && (nearlyDone || stalled)) {
    startFinale(w);
  }
  if (w.grid.remaining <= 0) {
    w.state = 'clear';
    w.events.push({ t: 'clear' });
    return;
  }
  const zapsLeft = w.finale && w.pending.some((p) => p.kind === 'zap');
  if (w.state === 'play' && w.balls.n === 0 && !zapsLeft) {
    w.lives--;
    w.drops = [];
    w.events.push({ t: 'lost' });
    w.state = w.lives > 0 ? 'ready' : 'over';
    if (w.state === 'over') w.events.push({ t: 'over' });
  }
  w.paddle = { ...w.paddle, prevX: w.paddle.x };
}
