import { CELL, COLS, BALL_R } from './constants.js';
import { startFinale } from './cells.js';
import { stunPaddle } from './units.js';

// Bosses: the big ones on every 10th stage float and move above their arena's
// bricks; every map also has its own mid-size boss (mapBosses.js) that roams a
// band under the box ceiling, right over the mural if need be. Balls bounce off its body and chip its hit points (within a per-second
// damage budget, so a swarm of thousands can't melt it in a blink). Armour
// plates orbit it and block balls. It fights in three phases and attacks the
// paddle with a telegraphed move: a warning, then the strike.

export const BOSS_KINDS = Object.freeze(['colossus', 'kraken', 'golem', 'mothership']);
const KIND = Object.freeze({
  colossus: { r: 9.5, move: 'sway', attack: 'stomp', zone: 18 },
  kraken: { r: 9, move: 'eight', attack: 'slam', zone: 9 },
  golem: { r: 9.5, move: 'hop', attack: 'rock', zone: 7 },
  mothership: { r: 10.5, move: 'glide', attack: 'sweep', zone: 0 },
});
export const PLATES = 4;
const PLATE_R = 1.8;
const PLATE_GAP = 2.6; // plate orbit beyond the body
export const PHASE2 = 0.6; // below this share of hp: angry (faster, more attacks)
export const PHASE3 = 0.25; // below this: plates fall away, it reels (stunned), then rushes about
export const STUN_TIME = 3; // seconds the armour break leaves it reeling: still, harmless, hit twice as hard
const STUN_DAMAGE = 2;
const PACE = [1, 1.4, 1.9]; // movement and plate speed per phase
const ATTACK_PACE = [1, 0.75, 0.55]; // time between attacks per phase
export const ATTACK_EVERY = 4.5; // seconds between attacks in phase 1 (the first comes after exactly this)
export const WARN_TIME = 1.0; // seconds an attack is telegraphed before it lands
const SWEEP_TIME = 1.2; // seconds a sweeping beam takes to cross the paddle row
const BUDGET_SECONDS = 2; // damage a quiet moment can bank, in seconds of its rate
const HOP_EVERY = 2.2;
const HOP_TIME = 0.6;

/** Highest row inside the box that still holds anything (the boss floats above it). */
function floorRow(grid) {
  const { box } = grid;
  for (let r = box.top - 1; r > box.bottom; r--) {
    for (let c = box.left + 1; c < box.right; c++) if (grid.cells[r * COLS + c] !== CELL.EMPTY) return r;
  }
  return box.bottom;
}

/**
 * @param {{ kind:string, hp:number, dps:number, tier:number, r?:number, plates?:number, band?:number,
 *   move?:string, attack?:string, zone?:number, attacks?:boolean, attackEvery?:number }} spec
 *   the optional fields override the big boss's own (KIND); `band` lets it roam that many
 *   rows under the ceiling over the bricks, instead of only above them
 * @param {object} grid parsed grid (its box frames the arena)
 * @param {() => number} rng
 */
export function createBoss(spec, grid, rng) {
  const base = KIND[spec.kind] ?? KIND.colossus;
  const k = {
    r: spec.r ?? base.r,
    move: spec.move ?? base.move,
    attack: spec.attack ?? base.attack,
    zone: spec.zone ?? base.zone,
  };
  const plateCount = spec.plates ?? PLATES;
  const { box } = grid;
  // Keep the whole thing (plates included) inside the box: a plate swinging
  // through a wall would push balls straight through the steel.
  const reach = k.r + PLATE_GAP + PLATE_R + BALL_R;
  const xMin = box.left + 1 + reach;
  const xMax = box.right - reach;
  const yMax = box.top - reach;
  const above = floorRow(grid) + 1 + reach; // clear of the bricks
  const low = spec.band ? Math.min(above, yMax - spec.band) : above;
  const yMin = Math.min(yMax, Math.max(box.bottom + 1 + reach, low));
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  return {
    kind: spec.kind,
    move: k.move,
    attackKind: k.attack,
    zone: k.zone,
    attacks: spec.attacks ?? true,
    attackEvery: spec.attackEvery ?? ATTACK_EVERY,
    alive: true,
    hp: spec.hp,
    hpMax: spec.hp,
    dps: spec.dps,
    budget: spec.dps, // one second's worth to start with
    tier: spec.tier,
    phase: 1,
    stun: 0, // seconds left reeling after its armour broke
    r: k.r,
    x: cx,
    y: cy,
    bounds: { xMin, xMax, yMin, yMax, cx, cy },
    t: 0,
    hop: { from: cx, to: cx, t: HOP_TIME, next: HOP_EVERY },
    plates: Array.from({ length: plateCount }, (_, j) => {
      const angle = (j / plateCount) * Math.PI * 2;
      return { angle, x: cx + Math.cos(angle) * (k.r + PLATE_GAP), y: cy + Math.sin(angle) * (k.r + PLATE_GAP) };
    }),
    plateOrbit: k.r + PLATE_GAP,
    plateR: PLATE_R,
    reach,
    attackTimer: spec.attackEvery ?? ATTACK_EVERY,
    attack: null, // { kind, stage:'warn'|'sweep', t, x, w, dir, hit, beam }
    rng,
  };
}

/** Moves the boss along its style's path; plates spin round it. */
function move(b, dt) {
  const pace = PACE[b.phase - 1];
  b.t += dt * pace;
  const { xMin, xMax, yMin, yMax, cx, cy } = b.bounds;
  const ax = (xMax - xMin) / 2;
  const ay = (yMax - yMin) / 2;
  const style = b.move;
  if (style === 'sway') {
    b.x = cx + ax * Math.sin(b.t * 0.6);
    b.y = cy + ay * 0.3 * Math.sin(b.t * 1.1);
  } else if (style === 'eight') {
    b.x = cx + ax * Math.sin(b.t * 0.7);
    b.y = cy + ay * 0.8 * Math.sin(b.t * 1.4);
  } else if (style === 'glide') {
    b.x = cx + ax * Math.sin(b.t * 0.5);
    b.y = cy + ay * 0.5 * Math.sin(b.t * 0.9);
  } else {
    // Hop: pick a spot, leap there in an arc, rest, repeat.
    const h = b.hop;
    h.next -= dt * pace;
    if (h.next <= 0) {
      h.from = b.x;
      h.to = xMin + b.rng() * (xMax - xMin);
      h.t = 0;
      h.next = HOP_EVERY;
    }
    if (h.t < HOP_TIME) {
      h.t = Math.min(HOP_TIME, h.t + dt * pace);
      const u = h.t / HOP_TIME;
      b.x = h.from + (h.to - h.from) * (u * u * (3 - 2 * u));
      b.y = yMin + (yMax - yMin) * (0.25 + 0.6 * Math.sin(u * Math.PI));
    } else b.y = yMin + (yMax - yMin) * 0.25;
  }
  b.x = Math.min(xMax, Math.max(xMin, b.x));
  b.y = Math.min(yMax, Math.max(yMin, b.y));
  // Plate centres once per frame (thousands of balls test against them).
  for (const p of b.plates) {
    p.angle += dt * 1.6 * pace;
    p.x = b.x + Math.cos(p.angle) * b.plateOrbit;
    p.y = b.y + Math.sin(p.angle) * b.plateOrbit;
  }
}

/**
 * Takes damage from the per-second budget; past it, hits bounce off a shield.
 * Crossing a phase threshold or reaching zero changes the fight.
 */
export function damageBoss(w, base) {
  const b = w.boss;
  if (!b || !b.alive) return;
  const amount = b.stun > 0 ? base * STUN_DAMAGE : base;
  if (b.budget < amount) {
    if (b.shieldAt !== w.time) {
      b.shieldAt = w.time; // one shield flash per step is plenty
      w.events.push({ t: 'boss-shield' });
    }
    return;
  }
  b.budget -= amount;
  b.hp = Math.max(0, b.hp - amount);
  w.score += 20 * amount;
  w.events.push({ t: 'boss-hit', x: b.x, y: b.y, dmg: amount });
  const share = b.hp / b.hpMax;
  const phase = share <= PHASE3 ? 3 : share <= PHASE2 ? 2 : 1;
  if (phase > b.phase) {
    b.phase = phase;
    w.events.push({ t: 'boss-phase', phase, x: b.x, y: b.y });
    if (phase === 3) {
      // The armour falls away and the blow leaves it reeling: no moves, no attacks, double damage.
      const plates = b.plates.length;
      b.plates = [];
      b.attack = null;
      b.stun = STUN_TIME;
      b.budget += b.dps * STUN_TIME; // room for the double hits, or the shield would eat them
      w.events.push({ t: 'boss-stun', x: b.x, y: b.y, dur: STUN_TIME, plates });
    }
  }
  if (b.hp <= 0) {
    b.alive = false;
    b.attack = null;
    w.score += 5000;
    w.events.push({ t: 'boss-down', x: b.x, y: b.y, kind: b.kind });
    startFinale(w); // the rest of the arena shatters
  }
}

/** Bounces ball i off a circle (cx, cy, radius) if it is touching and moving into it. */
function bounce(b, i, cx, cy, radius) {
  const dx = b.x[i] - cx;
  const dy = b.y[i] - cy;
  const d = Math.hypot(dx, dy);
  if (d >= radius + BALL_R || d < 1e-6) return false;
  const nx = dx / d;
  const ny = dy / d;
  const vn = b.vx[i] * nx + b.vy[i] * ny;
  if (vn >= 0) return false; // already heading away
  b.vx[i] -= 2 * vn * nx;
  b.vy[i] -= 2 * vn * ny;
  b.x[i] = cx + nx * (radius + BALL_R + 0.01);
  b.y[i] = cy + ny * (radius + BALL_R + 0.01);
  return true;
}

/** Ball i against the boss: plates block, the body bounces and takes a hit. @returns {boolean} bounced */
export function collideBoss(w, i) {
  const boss = w.boss;
  if (!boss || !boss.alive) return false;
  const b = w.balls;
  // Most balls are nowhere near the boss: a cheap box test first.
  if (Math.abs(b.x[i] - boss.x) > boss.reach || Math.abs(b.y[i] - boss.y) > boss.reach) return false;
  for (const p of boss.plates) {
    if (bounce(b, i, p.x, p.y, boss.plateR)) return true;
  }
  if (bounce(b, i, boss.x, boss.y, boss.r)) {
    damageBoss(w, 1);
    return true;
  }
  return false;
}

/** Is the paddle inside a zone of width `width` centred on x? */
const paddleIn = (w, x, width) => Math.abs(w.paddle.x - x) <= width / 2 + w.paddle.w / 2;

function hitPaddle(w, attack) {
  if (attack.hit || w.stun > 0) return;
  attack.hit = true;
  stunPaddle(w, w.boss.tier);
}

function startAttack(w, b) {
  const kind = b.attackKind;
  const dir = kind === 'sweep' ? (b.rng() < 0.5 ? 1 : -1) : 0;
  const x = kind === 'stomp' ? b.x : kind === 'sweep' ? (dir > 0 ? 0 : COLS) : w.paddle.x;
  b.attack = { kind, stage: 'warn', t: WARN_TIME, x, w: b.zone, dir, hit: false, beam: x };
  w.events.push({ t: 'boss-warn', kind, x, w: b.zone, dir, dur: WARN_TIME, from: { x: b.x, y: b.y } });
}

function runAttack(w, b, dt) {
  const a = b.attack;
  a.t -= dt;
  if (a.stage === 'warn') {
    if (a.t > 0) return;
    w.events.push({ t: 'boss-strike', kind: a.kind, x: a.x, w: a.w, dir: a.dir });
    if (a.kind !== 'sweep') {
      if (paddleIn(w, a.x, a.w)) hitPaddle(w, a);
      b.attack = null;
      return;
    }
    a.stage = 'sweep';
    a.t = SWEEP_TIME;
  }
  // The beam crosses the paddle row from one side to the other.
  const u = 1 - Math.max(0, a.t) / SWEEP_TIME;
  a.beam = a.dir > 0 ? u * COLS : COLS - u * COLS;
  if (paddleIn(w, a.beam, 1)) hitPaddle(w, a);
  if (a.t <= 0) b.attack = null;
}

/** Per-frame boss behaviour: movement always; damage budget and attacks only in play. */
export function updateBoss(w, dt) {
  const b = w.boss;
  if (!b || !b.alive) return;
  if (b.stun > 0) {
    // Reeling: it stays where the blow caught it until it shakes it off.
    b.stun = Math.max(0, b.stun - dt);
    if (b.stun === 0) w.events.push({ t: 'boss-wake', x: b.x, y: b.y });
    else return;
  }
  move(b, dt);
  if (w.state !== 'play') {
    if (w.state !== 'clear') b.attack = null; // a life lost or game over calls off the pending blow
    return;
  }
  b.budget = Math.min(b.dps * BUDGET_SECONDS, b.budget + b.dps * dt);
  if (b.attack) { runAttack(w, b, dt); return; }
  if (!b.attacks) return;
  b.attackTimer -= dt;
  if (b.attackTimer > 0) return;
  startAttack(w, b);
  b.attackTimer = b.attackEvery * ATTACK_PACE[b.phase - 1] * (0.85 + 0.3 * b.rng());
}
