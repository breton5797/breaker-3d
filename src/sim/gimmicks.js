import { CELL, COLS, BALL_SPEED_INSIDE } from './constants.js';
import { breakCell } from './cells.js';

// One play twist per theme of the "경이의 세계" chapter. All of them steer or
// add to the game without changing ball speed, so stage pacing stays the same.
// - space:  gravity wells inside the box bend passing balls toward them
// - sea:    currents in bands of rows push balls sideways
// - nature: lightning storms warn, then smash a column of bricks
// The sim updates balls in place (thousands per frame), so this module does too.

const WELLS = 2;
const WELL_RADIUS = 9; // cells
// Wells and currents sit inside the box, where balls fly at BALL_SPEED_INSIDE: a bend is pull / speed
// and the time in range 1 / speed, so the forces scale with speed² to feel as they did at 36 cells/s.
const FEEL = (BALL_SPEED_INSIDE / 36) ** 2;
const WELL_PULL = 320 * FEEL; // pull strength (cells/s² scale)
const BANDS = 2;
const BAND_ROWS = 4;
const CURRENT = 60 * FEEL; // sideways push (cells/s²)
export const MIN_VY = 0.3; // wells and currents never flatten a ball below this share of its speed
export const STORM_PERIOD = 5; // seconds between strikes (the first comes after exactly this long)
export const STORM_WARNING = 0.9; // seconds the doomed column flickers before the bolt
const STORM_DEPTH = 6; // bricks a bolt breaks, top down

/**
 * @param {'space'|'sea'|'nature'|null} theme
 * @param {{ box:{left:number,right:number,bottom:number,top:number}, rng:()=>number }} ctx
 * @returns {object|null} gimmick state (plain data), or null for no twist
 */
export function createGimmick(theme, { box, rng }) {
  const inner = { left: box.left + 1, right: box.right - 1, bottom: box.bottom + 1, top: box.top - 1 };
  const span = (lo, hi, pad) => lo + pad + rng() * Math.max(0, hi - lo - 2 * pad);
  if (theme === 'space') {
    const wells = Array.from({ length: WELLS }, (_, k) => {
      // One well in each half of the box so they don't sit on top of each other.
      const half = (inner.right - inner.left) / 2;
      const lo = inner.left + k * half;
      return { x: span(lo, lo + half, 4), y: span(inner.bottom, inner.top, 6), r: WELL_RADIUS };
    });
    return { theme, wells };
  }
  if (theme === 'sea') {
    const first = rng() < 0.5 ? 1 : -1;
    const height = inner.top - inner.bottom;
    const bands = Array.from({ length: BANDS }, (_, k) => {
      const bottom = Math.round(inner.bottom + (height * (k + 1)) / (BANDS + 1) - BAND_ROWS / 2);
      return { left: inner.left, right: inner.right + 1, bottom, top: bottom + BAND_ROWS, dir: k % 2 ? -first : first };
    });
    return { theme, bands };
  }
  if (theme === 'nature') {
    return { theme, box: inner, timer: 0, period: STORM_PERIOD, warned: -1, strikeIn: 0, rng };
  }
  return null;
}

/** Keeps ball i at `speed`, and (if minVy) its vertical share and direction above minVy. */
function setSpeed(b, i, speed, minVy, vySign) {
  let s = Math.hypot(b.vx[i], b.vy[i]) || 1;
  b.vx[i] *= speed / s;
  b.vy[i] *= speed / s;
  if (minVy && Math.abs(b.vy[i]) < minVy * speed) {
    b.vy[i] = vySign * minVy * speed;
    b.vx[i] = Math.sign(b.vx[i]) * Math.sqrt(Math.max(0, speed * speed - b.vy[i] * b.vy[i]));
  }
}

/** Steers ball i for dt seconds (space wells, sea currents). Speed never changes. */
export function bendBall(g, b, i, dt) {
  if (!g) return;
  const x = b.x[i];
  const y = b.y[i];
  if (g.wells) {
    for (const well of g.wells) {
      const dx = well.x - x;
      const dy = well.y - y;
      const d = Math.hypot(dx, dy);
      if (d >= well.r || d < 0.2) continue;
      const speed = Math.hypot(b.vx[i], b.vy[i]);
      const vySign = Math.sign(b.vy[i]) || 1;
      const a = (WELL_PULL * (1 - d / well.r)) / Math.max(d, 1.5);
      b.vx[i] += (dx / d) * a * dt;
      b.vy[i] += (dy / d) * a * dt;
      // Never flat: a sideways ball in a cleared row would bounce wall to wall for good.
      setSpeed(b, i, speed, MIN_VY, Math.sign(b.vy[i]) || vySign);
    }
  } else if (g.bands) {
    for (const band of g.bands) {
      if (x < band.left || x >= band.right || y < band.bottom || y >= band.top) continue;
      const speed = Math.hypot(b.vx[i], b.vy[i]);
      const vySign = Math.sign(b.vy[i]) || 1;
      b.vx[i] += band.dir * CURRENT * dt;
      setSpeed(b, i, speed, MIN_VY, vySign);
    }
  }
}

/** A column inside the box that still has something a bolt can break, or -1. */
function stormColumn(w, g) {
  const cols = [];
  for (let c = g.box.left; c <= g.box.right; c++) {
    for (let r = g.box.top; r >= g.box.bottom; r--) {
      const cell = w.grid.cells[r * COLS + c];
      if (cell !== CELL.EMPTY && cell !== CELL.STEEL) { cols.push(c); break; }
    }
  }
  return cols.length ? cols[Math.floor(g.rng() * cols.length)] : -1;
}

/** The bolt: breaks up to STORM_DEPTH bricks in column c, from the top of the box down. */
function strike(w, g, c) {
  let left = STORM_DEPTH;
  for (let r = g.box.top; r >= g.box.bottom && left > 0; r--) {
    const cell = w.grid.cells[r * COLS + c];
    if (cell === CELL.EMPTY || cell === CELL.STEEL) continue;
    breakCell(w, c, r);
    left--;
  }
  w.events.push({ t: 'storm', c, top: g.box.top, bottom: g.box.bottom });
}

/** Per-frame timers (nature storms). Storms wait while the ball sits on the paddle. */
export function updateGimmick(w, dt) {
  const g = w.gimmick;
  if (!g || g.theme !== 'nature' || w.state !== 'play') return;
  if (g.warned >= 0) {
    g.strikeIn -= dt;
    if (g.strikeIn <= 0) {
      strike(w, g, g.warned);
      g.warned = -1;
      g.timer = 0;
      g.period = STORM_PERIOD * (0.8 + 0.4 * g.rng());
    }
    return;
  }
  g.timer += dt;
  if (g.timer < g.period) return;
  const c = stormColumn(w, g);
  if (c < 0) { g.timer = 0; return; }
  g.warned = c;
  g.strikeIn = STORM_WARNING;
  w.events.push({ t: 'storm-warn', c, top: g.box.top, bottom: g.box.bottom });
}
