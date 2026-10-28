import {
  COLS, ROWS, CELL, SPLIT_COUNT, BOMB_RADIUS, BOMB_DELAY, FIRE_TIME, BALL_SPEED, COMBO_WINDOW, FINALE_GAP, ITEM_MULT, GOLD_BRICK_COINS,
} from './constants.js';
import { addBall } from './balls.js';

export const MIN_VY = 0.22; // fraction of speed a ball must keep vertically

/** Reports a ball knocking on steel or the field wall (a few per step, for sparks and a tink). */
export function wallKnock(w, i) {
  if (!(w.wallKnocks > 0)) return;
  w.wallKnocks--;
  w.events.push({ t: 'wall', x: w.balls.x[i], y: w.balls.y[i] });
}

/** Points a ball along `angle` (radians from straight up), keeping it from going flat. */
export function aimBall(b, i, angle, speed = BALL_SPEED) {
  const lim = Math.acos(MIN_VY);
  let a = angle;
  const up = Math.cos(a) >= 0;
  // Fold the angle so |cos| >= MIN_VY while preserving up/down direction.
  const s = Math.sin(a);
  const clampedS = Math.max(-Math.sin(lim), Math.min(Math.sin(lim), s));
  a = Math.asin(clampedS);
  b.vx[i] = Math.sin(a) * speed;
  b.vy[i] = Math.cos(a) * speed * (up ? 1 : -1);
}

/** Splits ball i into n balls fanned around its current heading. */
export function splitBall(w, i, n) {
  const b = w.balls;
  const speed = Math.hypot(b.vx[i], b.vy[i]) || BALL_SPEED;
  const heading = Math.atan2(b.vx[i], b.vy[i]);
  const spread = 0.42;
  let made = 0;
  for (let k = 1; k < n; k++) {
    if (!addBall(b, b.x[i], b.y[i], 0, 0, 0)) break;
    b.lastCell[b.n - 1] = b.lastCell[i];
    const off = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * spread + (w.rng() - 0.5) * 0.15;
    aimBall(b, b.n - 1, heading + off, speed);
    made++;
  }
  return made;
}

/** Spawns n balls from a cell centre (used when explosions pop split cells). */
function burstBalls(w, c, r, n) {
  for (let k = 0; k < n; k++) {
    if (!addBall(w.balls, c + 0.5, r + 0.5, 0, 0, 0)) return;
    aimBall(w.balls, w.balls.n - 1, (w.rng() - 0.5) * 2.4 + (w.rng() < 0.3 ? Math.PI : 0));
  }
}

function schedule(w, kind, c, r, delay) {
  w.pending = [...w.pending, { t: w.time + delay, kind, c, r }];
}

/**
 * Removes a breakable cell and triggers its special effect.
 * @param {number} ball index of the ball that broke it, or -1 for explosions/lasers
 */
export function breakCell(w, c, r, ball = -1) {
  const g = w.grid;
  const i = r * COLS + c;
  const type = g.cells[i];
  if (type === CELL.EMPTY || type === CELL.STEEL) return;
  const tier = g.tier[i];
  g.cells[i] = CELL.EMPTY;
  g.hp[i] = 0;
  g.remaining--;
  w.broken++;
  w.lastBreak = w.time;
  w.combo++;
  w.bestCombo = Math.max(w.bestCombo, w.combo);
  w.comboTimer = COMBO_WINDOW;
  w.score += 10 * (1 + Math.floor(w.combo / 25));
  w.events.push({ t: 'break', c, r, type, color: g.color[i] });

  if (type === CELL.UNIT) {
    g.tier[i] = 0;
    w.score += 200 * tier;
    w.topKill = Math.max(w.topKill, tier);
    w.events.push({ t: 'unit-down', c, r, tier });
    // Veterans (tier 5+) leave a multiplier behind.
    if (tier >= 5) {
      const mult = tier >= 9 ? 20 : tier >= 7 ? 10 : 5;
      w.drops = [...w.drops, { x: c + 0.5, y: r + 0.5, mult }];
      w.events.push({ t: 'drop', c, r, mult });
    }
  }
  if (type === CELL.COIN) {
    w.coins = [...w.coins, { x: c + 0.5, y: r + 0.5 }];
    w.events.push({ t: 'coin-drop', c, r });
  }
  if (ITEM_MULT[type]) {
    w.drops = [...w.drops, { x: c + 0.5, y: r + 0.5, mult: ITEM_MULT[type] }];
    w.events.push({ t: 'drop', c, r, mult: ITEM_MULT[type] });
  }
  const n = SPLIT_COUNT[type];
  if (n) {
    // A ball wearing out a gate already split in hitCell; explosions burst it.
    if (ball < 0) {
      burstBalls(w, c, r, n);
      w.events.push({ t: 'split', c, r, n });
    }
  } else if (type === CELL.BOMB) {
    schedule(w, 'boom', c, r, ball >= 0 ? 0 : BOMB_DELAY);
  } else if (type === CELL.LASER_H || type === CELL.LASER_V) {
    schedule(w, type === CELL.LASER_H ? 'laserH' : 'laserV', c, r, ball >= 0 ? 0 : BOMB_DELAY);
  } else if (type === CELL.GOLD) {
    w.gold += GOLD_BRICK_COINS;
    w.score += 500;
    w.events.push({ t: 'gold', c, r, coins: GOLD_BRICK_COINS });
  } else if (type === CELL.FIRE && ball >= 0) {
    w.balls.fire[ball] = FIRE_TIME;
    w.events.push({ t: 'fire', c, r });
  }
}

/**
 * A ball touched solid cell (c, r).
 * @returns {boolean} whether the ball should bounce
 */
export function hitCell(w, c, r, ball) {
  const i = r * COLS + c;
  const type = w.grid.cells[i];
  if (type === CELL.STEEL) { wallKnock(w, ball); return true; }
  const onFire = w.balls.fire[ball] > 0;
  const n = SPLIT_COUNT[type];
  if (n) {
    const b = w.balls;
    const inside = Math.floor(b.x[ball]) === c && Math.floor(b.y[ball]) === r;
    // Only the gate holding the ball's centre fires, once per pass.
    if (!inside || b.lastCell[ball] === i) return false;
    w.balls.lastCell[ball] = i;
    const made = splitBall(w, ball, n);
    w.events.push({ t: 'split', c, r, n: made + 1 });
    if (--w.grid.hp[i] <= 0) breakCell(w, c, r, ball);
    return false;
  }
  if ((type === CELL.BRICK || type === CELL.UNIT) && w.grid.hp[i] > 1 && !onFire) {
    w.grid.hp[i]--;
    w.events.push({ t: type === CELL.UNIT ? 'unit-hit' : 'hit', c, r });
    return true;
  }
  breakCell(w, c, r, ball);
  if (onFire) return false;
  return type !== CELL.FIRE && type !== CELL.GOLD;
}

function explode(w, c, r) {
  w.events.push({ t: 'boom', c, r });
  const rad = Math.ceil(BOMB_RADIUS);
  for (let y = r - rad; y <= r + rad; y++) {
    for (let x = c - rad; x <= c + rad; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      if (Math.hypot(x - c, y - r) <= BOMB_RADIUS) breakCell(w, x, y, -1);
    }
  }
}

function laser(w, c, r, horizontal) {
  w.events.push({ t: 'laser', axis: horizontal ? 'h' : 'v', c, r });
  const len = horizontal ? COLS : ROWS;
  for (let k = 0; k < len; k++) breakCell(w, horizontal ? k : c, horizontal ? r : k, -1);
}

function zap(w, c, r) {
  if (w.grid.cells[r * COLS + c] === CELL.EMPTY) return;
  w.events.push({ t: 'zap', c, r });
  breakCell(w, c, r, -1);
}

/** Schedules a lightning zap on every remaining breakable cell, top row first. */
export function startFinale(w) {
  const g = w.grid;
  const targets = [];
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i] !== CELL.EMPTY && g.cells[i] !== CELL.STEEL) targets.push(i);
  }
  // Sweep from the top of the wall down, centre-out within a row.
  const row = (i) => Math.floor(i / COLS);
  const off = (i) => Math.abs((i % COLS) - COLS / 2);
  targets.sort((a, b) => row(b) - row(a) || off(a) - off(b));
  w.finale = true;
  w.events.push({ t: 'finale', n: targets.length });
  const gap = Math.min(FINALE_GAP, 2 / Math.max(1, targets.length));
  w.pending = [
    ...w.pending,
    ...targets.map((i, k) => ({ t: w.time + 0.3 + k * gap, kind: 'zap', c: i % COLS, r: Math.floor(i / COLS) })),
  ];
}

/** Fires every scheduled explosion/laser whose time has come (may schedule more). */
export function processPending(w) {
  for (let guard = 0; guard < 64 && w.pending.some((p) => p.t <= w.time); guard++) {
    const due = w.pending.filter((p) => p.t <= w.time);
    w.pending = w.pending.filter((p) => p.t > w.time);
    for (const p of due) {
      if (p.kind === 'boom') explode(w, p.c, p.r);
      else if (p.kind === 'zap') zap(w, p.c, p.r);
      else laser(w, p.c, p.r, p.kind === 'laserH');
    }
  }
}
