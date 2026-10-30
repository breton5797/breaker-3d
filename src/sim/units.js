import { COLS, CELL, PADDLE_Y, PADDLE_H, UNIT_TIERS, UNIT_GRACE, MAX_SHELLS, LONE_BALLS, LONE_PACE } from './constants.js';
import { refreshPaddle } from './paddle.js';
import { isInside } from './box.js';

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;
const SPREAD = 4.4; // sideways speed between bombs of one volley

/** Lists every unit cell of a freshly parsed grid with its fire cooldown. */
export function buildUnits(grid, rng) {
  const units = [];
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] !== CELL.UNIT) continue;
    const tier = grid.tier[i];
    units.push({ c: i % COLS, r: Math.floor(i / COLS), tier, cd: UNIT_GRACE + rng() * UNIT_TIERS[tier - 1].interval });
  }
  return units;
}

function volley(w, u) {
  const spec = UNIT_TIERS[u.tier - 1];
  const x = u.c + 0.5;
  const y = u.r;
  // Lead the paddle: aim 1 lands on the paddle's current spot.
  const speed = spec.speed * (1 + (w.aggression - 1) * 0.5);
  const fall = Math.max(0.5, (y - PADDLE_Y) / speed);
  const lead = (spec.aim * (w.paddle.x - x)) / fall;
  const shells = [];
  for (let k = 0; k < spec.shots; k++) {
    shells.push({ x, y, vx: lead + (k - (spec.shots - 1) / 2) * SPREAD, vy: -speed, tier: u.tier });
  }
  w.shells = [...w.shells, ...shells].slice(-MAX_SHELLS);
  w.events.push({ t: 'fire-shell', c: u.c, r: u.r, tier: u.tier });
}

/** True when at least one ball is inside the landmark's box. */
export function ballInside(w) {
  for (let i = 0; i < w.balls.n; i++) if (isInside(w.grid, w.balls.x[i], w.balls.y[i])) return true;
  return false;
}

/** How many balls are inside the box, counting up to `max` (enough to tell a lonely ball from a swarm). */
export function insideCount(w, max = Infinity) {
  let n = 0;
  for (let i = 0; i < w.balls.n && n < max; i++) if (isInside(w.grid, w.balls.x[i], w.balls.y[i])) n++;
  return n;
}

/** Counts down each living unit and fires when ready. Dead units drop out. */
export function updateUnits(w, dt) {
  // Units only fight intruders: they fire while some ball is inside the wall.
  if (!w.units.length) return;
  const inside = insideCount(w, LONE_BALLS + 1);
  if (inside === 0) return;
  // A lonely ball digging gets more room between volleys (the stun -> ball lost loop of the audit).
  const pace = inside <= LONE_BALLS ? LONE_PACE : 1;
  const alive = w.units.filter((u) => w.grid.cells[u.r * COLS + u.c] === CELL.UNIT);
  w.units = alive.map((u) => {
    const cd = u.cd - dt;
    if (cd > 0) return { ...u, cd };
    volley(w, u);
    return { ...u, cd: (UNIT_TIERS[u.tier - 1].interval / w.aggression) * pace * (0.75 + w.rng() * 0.5) };
  });
}

/** A bomb (or a boss attack) of this tier hit the paddle: stun it, and lethal tiers cost a life. */
export function stunPaddle(w, tier) {
  const spec = UNIT_TIERS[tier - 1];
  w.stun = Math.max(w.stun, spec.stun);
  refreshPaddle(w);
  w.events.push({ t: 'paddle-hit', x: w.paddle.x, tier, lethal: spec.lethal });
  if (spec.lethal) {
    w.lives--;
    if (w.lives <= 0) {
      w.state = 'over';
      w.events.push({ t: 'over' });
    }
  }
}

/** Moves enemy bombs; the paddle eats them (and the stun), the floor swallows the rest. */
export function updateShells(w, dt) {
  if (w.stun > 0) {
    w.stun = Math.max(0, w.stun - dt);
    if (w.stun === 0) refreshPaddle(w);
  }
  if (!w.shells.length) return;
  const p = w.paddle;
  const kept = [];
  for (const s of w.shells) {
    const x = s.x + s.vx * dt;
    const y = s.y + s.vy * dt;
    const onPaddle = y <= PADDLE_TOP + 0.3 && y >= PADDLE_Y - PADDLE_H && Math.abs(x - p.x) <= p.w / 2 + 0.3;
    // While stunned the paddle is invulnerable: bombs pass through it.
    if (onPaddle && w.state === 'play' && w.stun <= 0) stunPaddle(w, s.tier);
    else if (y > -1 && x > -2 && x < COLS + 2) kept.push({ ...s, x, y });
  }
  w.shells = kept;
}
