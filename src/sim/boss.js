import { CELL, COLS, PADDLE_Y, UNIT_TIERS, MAX_SHELLS } from './constants.js';

// Boss stages (every 10th): a giant mural with a core ('X'). While any core
// cell lives, broken armour grows back (nearest the core first) and the core
// lobs bombs at the paddle. Breaking the whole core brings the boss down: the
// regrowth stops and the rest of the mural shatters (cells.js starts the finale).

export const REGEN_EVERY = 1.2; // seconds between regrowth waves
const REGEN_BATCH = 8; // bricks regrown per wave
export const CORE_BLAST = 2; // what an explosion, laser or bolt takes off a core cell (no one-shots)
export const SHOT_EVERY = 3.2; // seconds between the boss's bombs
const BUDGET_SECONDS = 2; // core damage a quiet moment can bank, in seconds of its rate

/**
 * @param {object} grid parsed grid (core cells already carry their hp)
 * @param {{ coreHp:number, tier:number, dps?:number }} spec dps: core damage it can take per second
 * @param {() => number} rng
 * @param {number} brickHp hits a regrown brick takes
 */
export function createBoss(grid, spec, rng, brickHp) {
  const cores = [];
  for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] === CELL.CORE) cores.push(i);
  const cx = cores.reduce((s, i) => s + (i % COLS), 0) / Math.max(1, cores.length);
  const cy = cores.reduce((s, i) => s + Math.floor(i / COLS), 0) / Math.max(1, cores.length);
  const armour = [];
  for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] === CELL.BRICK) armour.push(i);
  const dist = (i) => Math.hypot((i % COLS) - cx, Math.floor(i / COLS) - cy);
  armour.sort((a, b) => dist(a) - dist(b));
  return {
    alive: cores.length > 0,
    cores: cores.length,
    coreCells: cores,
    coreHpMax: cores.length * spec.coreHp,
    tier: spec.tier,
    dps: spec.dps ?? 6,
    budget: spec.dps ?? 6, // one second's worth to start with
    brickHp,
    armour: Int32Array.from(armour),
    regenTimer: 0,
    shotTimer: SHOT_EVERY,
    rng,
  };
}

/**
 * Spends core damage from the per-second budget, so a swarm of thousands of
 * balls can't melt the core in a blink: hits past the budget bounce off a shield.
 * @returns {boolean} whether the damage lands
 */
export function spendCore(w, amount) {
  const b = w.boss;
  if (!b) return true;
  if (b.budget < amount) {
    if (b.shieldAt !== w.time) {
      b.shieldAt = w.time; // one shield flash per step is plenty
      w.events.push({ t: 'core-shield' });
    }
    return false;
  }
  b.budget -= amount;
  return true;
}

/** Hit points the core still has (for the boss health bar). */
export function coreHpLeft(w) {
  const b = w.boss;
  if (!b) return 0;
  let hp = 0;
  for (const i of b.coreCells) if (w.grid.cells[i] === CELL.CORE) hp += w.grid.hp[i];
  return hp;
}

function regrow(w, b) {
  let left = REGEN_BATCH;
  const g = w.grid;
  for (let k = 0; k < b.armour.length && left > 0; k++) {
    const i = b.armour[k];
    if (g.cells[i] !== CELL.EMPTY) continue;
    g.cells[i] = CELL.BRICK;
    g.hp[i] = b.brickHp;
    g.remaining++;
    left--;
    w.events.push({ t: 'regen', c: i % COLS, r: Math.floor(i / COLS) });
  }
}

function fire(w, b) {
  const live = b.coreCells.filter((i) => w.grid.cells[i] === CELL.CORE);
  if (!live.length) return;
  const i = live[Math.floor(b.rng() * live.length)];
  const x = (i % COLS) + 0.5;
  const y = Math.floor(i / COLS);
  const spec = UNIT_TIERS[b.tier - 1];
  const fall = Math.max(0.5, (y - PADDLE_Y) / spec.speed);
  // Aimed at where the paddle is now: keep moving and it misses.
  w.shells = [...w.shells, { x, y, vx: (w.paddle.x - x) / fall, vy: -spec.speed, tier: b.tier }].slice(-MAX_SHELLS);
  w.events.push({ t: 'boss-shot', c: i % COLS, r: Math.floor(i / COLS) });
}

/** Per-frame boss behaviour: regrowth and bombs, only while it lives and the game is on. */
export function updateBoss(w, dt) {
  const b = w.boss;
  if (!b || !b.alive || w.state !== 'play') return;
  b.budget = Math.min(b.dps * BUDGET_SECONDS, b.budget + b.dps * dt);
  b.regenTimer += dt;
  while (b.regenTimer >= REGEN_EVERY) {
    b.regenTimer -= REGEN_EVERY;
    regrow(w, b);
  }
  b.shotTimer -= dt;
  if (b.shotTimer <= 0) {
    fire(w, b);
    b.shotTimer = SHOT_EVERY * (0.8 + 0.4 * b.rng());
  }
}
