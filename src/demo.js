// Demo mode for gameplay videos (owner, 2026-11-17: daily short videos on the SWISHBY channels, the
// direction Jev chose). Open the game with ?demo=<stage> and a bot plays that stage: it follows the
// lowest falling ball, goes for falling fruit, sidesteps bombs and serves at varied angles. Same rules
// as scripts/autoplay.mjs. It only moves the paddle and serves; the game itself is unchanged.

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

/** Where the bot puts the paddle this frame. @param {object} w world @param {number} t seconds */
export function demoTarget(w, t) {
  let target = w.paddle.x;
  let low = Infinity;
  for (let i = 0; i < w.balls.n; i++) {
    if (w.balls.vy[i] < 0 && w.balls.y[i] < low) { low = w.balls.y[i]; target = w.balls.x[i]; }
  }
  // Falling fruit is worth more than any single ball.
  for (const d of w.drops) if (d.y - 7 < low) { low = d.y - 7; target = d.x; }
  // Sidestep a bomb about to land, unless a ball is about to land too.
  const threat = (w.shells ?? []).find((sh) => sh.y < 18 && Math.abs(sh.x + sh.vx * 0.3 - w.paddle.x) < w.paddle.w / 2 + 2);
  if (threat && low > 16) target = w.paddle.x + (threat.x < w.paddle.x ? 14 : -14);
  const aim = target + Math.sin(t * 1.7) * 4; // off-centre so returns fan out
  return w.paddle.x + Math.max(-STEP, Math.min(STEP, aim - w.paddle.x));
}
