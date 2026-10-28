import {
  COLS, ROWS, CELL, BALL_R, BALL_SPEED, MAX_SUBSTEP, PADDLE_Y, PADDLE_H, PADDLE_W,
  PADDLE_MAX_ANGLE, RELEASE_RATE, DROP_SPEED, START_LIVES, METEOR_FIRE, METEOR_COUNT, LAUNCH_BALLS, SPLIT_SKILL_MAX, FINALE_FRACTION, STALL_TIME, STALL_FRACTION, PRE_ENTRY_MAX,
} from './constants.js';
import { parseLevel } from './levels.js';
import { createBalls, addBall, removeBall } from './balls.js';
import { hitCell, processPending, splitBall, aimBall, startFinale } from './cells.js';
import { updateDrops } from './items.js';
import { buildUnits, updateUnits, updateShells, ballInside } from './units.js';
import { createBoss, updateBoss, collideBoss } from './boss.js';
import { createGimmick, bendBall, updateGimmick } from './gimmicks.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;
const CEILING_KICK = [0.2, 0.6]; // radians a ceiling bounce always tilts a ball by (min, max)

/**
 * @param {string[]} lines level text
 * @param {{ rng?: () => number, lives?: number, brickHp?: number, paddleW?: number, releaseRate?: number, box?: object, holes?: object[],
 *   dropSpeed?: number, aggression?: number, charges?: {split:number, meteor:number} }} [opts]
 */
export function createWorld(lines, opts = {}) {
  const grid = parseLevel(lines, { brickHp: opts.brickHp, box: opts.box, holes: opts.holes });
  const rng = opts.rng ?? Math.random;
  return {
    grid,
    boss: opts.boss && grid.box ? createBoss(opts.boss, grid, rng) : null,
    gimmick: opts.theme && opts.box ? createGimmick(opts.theme, { box: opts.box, rng }) : null,
    balls: createBalls(),
    rng,
    units: buildUnits(grid, rng), // enemy units { c, r, tier, cd }
    shells: [], // enemy bombs { x, y, vx, vy, tier }
    stun: 0, // seconds the paddle stays frozen after a bomb hit
    paddle: { x: COLS / 2, w: opts.paddleW ?? PADDLE_W, prevX: COLS / 2 },
    basePaddleW: opts.paddleW ?? PADDLE_W,
    releaseRate: opts.releaseRate ?? RELEASE_RATE,
    dropSpeed: opts.dropSpeed ?? DROP_SPEED, // how fast fruit falls
    aggression: opts.aggression ?? 1, // unit fire-rate and bomb-speed factor
    state: 'ready', // ready | play | clear | over
    lives: opts.lives ?? START_LIVES,
    drops: [], // falling multiplier items { x, y, mult }
    coins: [], // falling gold coins { x, y }
    gold: 0, // gold caught this stage
    collected: 0,
    catchStreak: 0, // fruits caught in a row without missing one
    bestStreak: 0,
    bestFruit: 0, // biggest fruit multiplier caught
    topKill: 0, // highest unit tier destroyed
    queued: 0, // balls owed by caught multipliers, released gradually
    releaseAcc: 0,
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
  if (w.stun > 0) return; // stunned by a unit bomb
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
  w.entered = false; // a new serve: the opening assist is back on until a ball gets in
  w.events.push({ t: 'launch' });
  return true;
}

/**
 * Continue a lost run (a rewarded revive): one life back, the ball waits on
 * the paddle, the bricks stay as they were. Only valid once the run is over.
 * @returns {boolean} whether it revived
 */
export function revive(w) {
  if (w.state !== 'over') return false;
  w.lives = 1;
  w.stun = 0;
  w.shells = [];
  w.drops = [];
  w.coins = [];
  w.state = 'ready';
  w.events.push({ t: 'revive' });
  return true;
}

/** @param {'split'|'meteor'} name */
export function useSkill(w, name) {
  if (w.charges[name] <= 0 || (w.state !== 'play' && w.state !== 'ready')) return false;
  const b = w.balls;
  if (name === 'split') {
    if (w.state !== 'play' || b.n === 0) return false;
    // Each ball becomes three, but one use adds at most SPLIT_SKILL_MAX balls
    // so stacked charges can't blow a whole stage away in seconds.
    const n0 = b.n;
    const cap = n0 + SPLIT_SKILL_MAX;
    for (let i = 0; i < n0 && b.n < cap; i++) splitBall(w, i, Math.min(3, 1 + cap - b.n));
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
  // Not in yet this serve: each return off the paddle brings a friend (more tries, less dead time).
  const assist = !w.entered && w.state === 'play' && b.n < PRE_ENTRY_MAX;
  let off = Math.max(-1, Math.min(1, (b.x[i] - p.x) / (p.w / 2)));
  // Never return a ball perfectly vertical: that can loop forever in a cleared column.
  if (Math.abs(off) < 0.08) off = w.rng() < 0.5 ? -0.08 : 0.08;
  aimBall(b, i, off * PADDLE_MAX_ANGLE, Math.hypot(b.vx[i], b.vy[i]));
  b.y[i] = PADDLE_TOP + BALL_R;
  if (assist && addBall(b, b.x[i], b.y[i], 0, 1)) aimBall(b, b.n - 1, -off * PADDLE_MAX_ANGLE * 0.8 + (w.rng() - 0.5) * 0.3, Math.hypot(b.vx[i], b.vy[i]));
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
  if (ny > ROWS - BALL_R) {
    // Bumpy ceiling: jitter the return angle so a ball that shot straight up a
    // shaft drifts into the bricks instead of falling straight back out.
    ny = ROWS - BALL_R;
    const kick = (CEILING_KICK[0] + w.rng() * (CEILING_KICK[1] - CEILING_KICK[0])) * (w.rng() < 0.5 ? -1 : 1);
    const angle = Math.PI - Math.atan2(b.vx[i], Math.abs(b.vy[i])) + kick;
    aimBall(b, i, angle, Math.hypot(b.vx[i], b.vy[i]));
  }
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
    if (w.gimmick) bendBall(w.gimmick, b, i, dt);
    const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
    for (let s = 0; s < steps; s++) {
      moveBall(w, i, dt / steps);
      if (w.boss) collideBoss(w, i);
    }
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
    updateUnits(w, dt);
    updateShells(w, dt);
    updateBoss(w, dt);
    updateGimmick(w, dt);
    if (!w.entered && ballInside(w)) {
      w.entered = true;
      w.events.push({ t: 'enter' });
    }
    w.peakBalls = Math.max(w.peakBalls, w.balls.n);
  }
  const g = w.grid;
  const nearlyDone = g.total >= 100 && g.remaining <= g.total * FINALE_FRACTION;
  const stalled = g.remaining <= g.total * STALL_FRACTION && w.time - w.lastBreak > STALL_TIME;
  // The mural is nearly gone: the last bricks shatter in the finale, and only
  // then can a living boss be beaten (boss.js keeps it above GUARD_FLOOR until now).
  if (!w.finale && w.state === 'play' && (nearlyDone || stalled || g.remaining <= 0)) {
    startFinale(w);
    if (w.boss?.alive) w.events.push({ t: 'boss-open', x: w.boss.x, y: w.boss.y });
  }
  // A boss stage ends only with the boss: an empty arena alone is not a win.
  if (w.grid.remaining <= 0 && !w.boss?.alive) {
    w.state = 'clear';
    w.events.push({ t: 'clear' });
    return;
  }
  const zapsLeft = w.finale && w.pending.some((p) => p.kind === 'zap');
  if (w.state === 'play' && w.balls.n === 0 && !zapsLeft) {
    w.lives--;
    w.drops = [];
    w.coins = [];
    w.shells = [];
    w.queued = 0;
    w.events.push({ t: 'lost' });
    w.state = w.lives > 0 ? 'ready' : 'over';
    if (w.state === 'over') w.events.push({ t: 'over' });
  }
  w.paddle = { ...w.paddle, prevX: w.paddle.x };
}
