// Demo mode for gameplay videos (owner, 2026-11-17: daily short videos on the SWISHBY channels, the
// direction Jev chose). Open the game with ?demo=<stage> and a bot plays that stage: it follows the
// lowest falling ball, goes for falling fruit, sidesteps bombs and serves at varied angles. Same rules
// as scripts/autoplay.mjs. It only moves the paddle and serves; the game itself is unchanged.

import { predictPath, AIM_MAX } from './sim/aim.js';
import { COLS, BALL_R, PADDLE_Y, PADDLE_H, PADDLE_MAX_ANGLE } from './sim/constants.js';

const MAX_STAGE = 1_000_000;
const STEP = 2.2; // most cells the paddle moves per frame (a quick human thumb)

/** @param {string} search location.search @returns {number|null} the 1-based demo stage, or null */
export function demoStage(search) {
  const raw = new URLSearchParams(search).get('demo');
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_STAGE ? n : null;
}

/** Serve angle (radians) for a demo serve at time t: a gentle sweep so shots fan out. */
export const demoAngle = (t) => Math.sin(t * 2.3) * 0.6;

const SCAN = 0.02; // radians between the serve angles the bot tries with the aim guide

/**
 * Serve angle for the demo bot: of the angles the aim guide (predictPath) says get into the box,
 * the one closest to the sweep angle (so serves still vary); the sweep itself when none gets in.
 * Blind sweep serves often hit the box wall and the swarm never grew (5 of 6 takes on 2026-11-18).
 * @param {object} w world, balls waiting on the paddle @param {number} t seconds
 * @param {typeof predictPath} [guide] the aim guide (tests swap it) @returns {number} radians
 */
export function demoServe(w, t, guide = predictPath) {
  const want = demoAngle(t);
  let best = null;
  for (let a = -AIM_MAX; a <= AIM_MAX; a += SCAN) {
    if ((best === null || Math.abs(a - want) < Math.abs(best - want)) && guide(w, a).end === 'enter') best = a;
  }
  return best ?? want;
}

const SMALL_SWARM = 40; // below this many balls the bot aims each return into the box
const RETURN_SCAN = 0.03; // radians between the return angles it tries
const MAX_OFF = 0.9; // hit no closer to the paddle's tip than this (a share of half its width)
const entries = new Map(); // `${bricks left}:${x}` -> return angles from x that get into the box

/** Return angles from paddle position x that the aim guide says get into the box (cached per layout). */
function entryAngles(w, x) {
  const key = `${w.grid.remaining}:${Math.round(x * 2)}`;
  if (!entries.has(key)) {
    if (entries.size > 2000) entries.clear();
    const from = { ...w, paddle: { ...w.paddle, x } };
    const ok = [];
    for (let a = -PADDLE_MAX_ANGLE * MAX_OFF; a <= PADDLE_MAX_ANGLE * MAX_OFF; a += RETURN_SCAN) {
      if (predictPath(from, a).end === 'enter') ok.push(a);
    }
    entries.set(key, ok);
  }
  return entries.get(key);
}

/** Where a falling ball crosses the paddle line (straight flight, side walls fold it back). */
function landingX(x, y, vx, vy) {
  const span = COLS - 2 * BALL_R;
  const raw = x - BALL_R + (vx * (y - PADDLE_Y - PADDLE_H / 2)) / -vy;
  const m = ((raw % (2 * span)) + 2 * span) % (2 * span);
  return BALL_R + (m > span ? 2 * span - m : m);
}

/** Paddle x that returns a ball landing at x into the box with the least paddle travel, or null. */
function returnInto(w, x) {
  const half = w.paddle.w / 2;
  let best = null;
  for (const a of entryAngles(w, x)) {
    const px = x - (a / PADDLE_MAX_ANGLE) * half; // world.js bouncePaddle: angle = off * PADDLE_MAX_ANGLE
    if (best === null || Math.abs(px - w.paddle.x) < Math.abs(best - w.paddle.x)) best = px;
  }
  return best;
}

/** Where the bot puts the paddle this frame. @param {object} w world @param {number} t seconds */
export function demoTarget(w, t) {
  let target = w.paddle.x;
  let low = Infinity;
  let ball = -1;
  for (let i = 0; i < w.balls.n; i++) {
    if (w.balls.vy[i] < 0 && w.balls.y[i] < low) { low = w.balls.y[i]; target = w.balls.x[i]; ball = i; }
  }
  // Falling fruit is worth more than any single ball.
  for (const d of w.drops) if (d.y - 7 < low) { low = d.y - 7; target = d.x; ball = -1; }
  let aim = target + Math.sin(t * 1.7) * 4; // off-centre so returns fan out
  // While the swarm is small, send the next return through a hole: that is what grows it.
  if (ball >= 0 && w.balls.n < SMALL_SWARM) {
    const b = w.balls;
    const into = returnInto(w, landingX(b.x[ball], b.y[ball], b.vx[ball], b.vy[ball]));
    if (into !== null) aim = into;
  }
  // Sidestep a bomb about to land, unless a ball is about to land too.
  const threat = (w.shells ?? []).find((sh) => sh.y < 18 && Math.abs(sh.x + sh.vx * 0.3 - w.paddle.x) < w.paddle.w / 2 + 2);
  if (threat && low > 16) aim = w.paddle.x + (threat.x < w.paddle.x ? 14 : -14);
  return w.paddle.x + Math.max(-STEP, Math.min(STEP, aim - w.paddle.x));
}
