import { COLS as GRID_COLS, ROWS, CELL, SPLIT_COUNT, SPLIT_USES, UNIT_TIERS, UNIT_CHARS } from './constants.js';

import { COLS, LEVELS, landmarkAt, toLines } from './maps.js';

// Stages are designed on a coarse grid (maps.js), then upscaled to the fine game grid.
const SCALE = GRID_COLS / COLS;

export { LEVELS };
import { mulberry32 } from './rng.js';
import { stageParams } from './stages.js';

export { stageParams };

const CHAR_CELL = {
  '#': CELL.BRICK,
  H: CELL.BRICK,
  S: CELL.STEEL,
  2: CELL.SPLIT2,
  3: CELL.SPLIT3,
  5: CELL.SPLIT5,
  B: CELL.BOMB,
  '-': CELL.LASER_H,
  '|': CELL.LASER_V,
  G: CELL.GOLD,
  F: CELL.FIRE,
  A: CELL.ITEM5,
  C: CELL.ITEM10,
  D: CELL.ITEM20,
  E: CELL.ITEM30,
  I: CELL.ITEM50,
  M: CELL.ITEM100,
};

/**
 * Parses text lines (top line = top of the field) into the cell grid.
 * Letters a-h are bricks with an explicit palette index; '#' bricks get a
 * stripe colour from their line.
 * @param {string[]} lines
 * @param {{ brickHp?: number }} [opts] hits a plain brick takes ('H' adds one more)
 */
export function parseLevel(lines, { brickHp = 1 } = {}) {
  const size = GRID_COLS * ROWS;
  const cells = new Uint8Array(size);
  const hp = new Uint8Array(size);
  const color = new Uint8Array(size);
  const tier = new Uint8Array(size); // unit tier 1-10 for UNIT cells
  let remaining = 0;
  lines.forEach((line, li) => {
    const r = ROWS - 1 - li;
    if (r < 0) return;
    for (let c = 0; c < Math.min(GRID_COLS, line.length); c++) {
      const ch = line[c];
      const code = ch.charCodeAt(0);
      const isLetter = code >= 97 && code <= 104; // a-h
      const unitTier = UNIT_CHARS.indexOf(ch) + 1;
      const type = isLetter ? CELL.BRICK : unitTier ? CELL.UNIT : CHAR_CELL[ch];
      if (!type) continue;
      const i = r * GRID_COLS + c;
      cells[i] = type;
      hp[i] = unitTier ? UNIT_TIERS[unitTier - 1].hp
        : SPLIT_COUNT[type] ? SPLIT_USES
        : ch === 'H' ? brickHp + 1
        : type === CELL.BRICK ? brickHp : 1;
      tier[i] = unitTier;
      color[i] = isLetter ? code - 97 : Math.floor(li / 5) % 8;
      if (type !== CELL.STEEL) remaining++;
    }
  });
  return { cells, hp, color, tier, remaining, total: remaining, floorRow: findFloorRow(cells) };
}

/**
 * Lowest row that is mostly steel: the sealed floor, or -1 when there is none.
 * "Mostly" (3/4) because beginner stages cut a hole up to 16 cells wide.
 */
const FLOOR_STEEL = Math.ceil(GRID_COLS * 0.75);

function findFloorRow(cells) {
  for (let r = 0; r < ROWS; r++) {
    let steel = 0;
    for (let c = 0; c < GRID_COLS; c++) if (cells[r * GRID_COLS + c] === CELL.STEEL) steel++;
    if (steel >= FLOOR_STEEL) return r;
  }
  return -1;
}

const GUTTER = 6; // empty fine rows under the ceiling where escaped balls go wild
const withGutter = (lines) => [...Array(GUTTER).fill('.'.repeat(GRID_COLS)), ...lines].slice(0, ROWS - 14);

// Cells that stay a single fine cell when upscaling; the rest of their block becomes brick.
const SINGLE = new Set(['A', 'C', 'D', 'E', 'I', 'M', 'B', '-', '|', 'G', 'F', '2', '3', '5', ...UNIT_CHARS]);

/** Upscales a coarse stage SCALE times: every cell becomes a SCALE x SCALE block of finer bricks. */
function upscale(lines) {
  return lines.flatMap((line) => Array.from({ length: SCALE }, (_, dy) => [...line].flatMap((ch) =>
    Array.from({ length: SCALE }, (_, dx) => (SINGLE.has(ch) && (dx || dy) ? '#' : ch))).join('')));
}

// Multiplier items: small ones (x5, x10) and big ones (x20..x100). The share of
// big ones shrinks as stages get harder.
const SMALL_ITEMS = [['A', 55], ['C', 45]];
const BIG_ITEMS = [['D', 45], ['E', 27], ['I', 20], ['M', 8]];
const GATE_TO_ITEM = { 2: 'A', 3: 'C', 5: 'D' };
const isPlainBrick = (c) => c === '#' || (c >= 'a' && c <= 'h');

function pickWeighted(rng, table) {
  let roll = rng() * table.reduce((sum, [, wt]) => sum + wt, 0);
  for (const [ch, wt] of table) {
    roll -= wt;
    if (roll < 0) return ch;
  }
  return table[0][0];
}
const pickItem = (rng, bigShare) => pickWeighted(rng, rng() < bigShare ? BIG_ITEMS : SMALL_ITEMS);

/**
 * Turns pass-through gates into item bricks and scatters extra items, so balls
 * multiply only when the player catches what falls out.
 */
function seedItems(lines, count, bigShare, seed) {
  const rng = mulberry32(seed);
  const g = lines.map((l) => [...l].map((ch) => GATE_TO_ITEM[ch] ?? ch));
  let placed = 0;
  for (let tries = 0; placed < count && tries < 5000; tries++) {
    const x = Math.floor(rng() * COLS);
    const y = Math.floor(rng() * g.length);
    if (isPlainBrick(g[y][x])) {
      g[y][x] = pickItem(rng, bigShare);
      placed++;
    }
  }
  return toLines(g);
}

/**
 * Hides `count` enemy units inside the wall: one commander of tier `top`, the
 * rest one to three tiers below it.
 */
function seedUnits(lines, top, count, seed) {
  const rng = mulberry32(seed);
  const g = lines.map((l) => [...l]);
  const deepest = g.length - 4; // keep clear of the sealed floor
  let placed = 0;
  for (let tries = 0; placed < count && tries < 20000; tries++) {
    const x = Math.floor(rng() * COLS);
    const y = Math.floor(rng() * deepest);
    if (!isPlainBrick(g[y][x])) continue;
    // One commander at the top tier; the squad is 1-3 tiers below, so at most
    // one unit per stage fires the deadliest (life-costing) bombs.
    const tier = placed === 0 ? top : Math.max(1, top - 1 - Math.floor(rng() * 3));
    g[y][x] = UNIT_CHARS[tier - 1];
    placed++;
  }
  return toLines(g);
}

const CAVITY = 8; // empty fine rows kept above the floor so an entering ball keeps going
const WALL_MARGIN = 6; // fine cells the hole always keeps from a side wall
const GUARD_GAP = 1; // empty fine rows between the floor and the entrance guard

/**
 * Where the entrance goes: centred at first, drifting toward a side wall as
 * `holeShift` grows (alternating sides stage by stage).
 * @returns {{ x0:number, w:number }} fine columns [x0, x0 + w)
 */
export function entranceSpan(p, n) {
  const maxOff = (GRID_COLS - p.holeW) / 2 - WALL_MARGIN;
  const side = n % 2 === 0 ? 1 : -1;
  const centre = GRID_COLS / 2 + side * p.holeShift * maxOff;
  return { x0: Math.round(centre - p.holeW / 2), w: p.holeW };
}

/**
 * Opens a full-width lobby above the steel floor. A ball that makes it through
 * the entrance rattles along the whole floor (the hole is the only way out)
 * instead of dropping straight back out of a hole-sized pocket.
 */
function carveLobby(coarse) {
  const rows = Math.ceil((CAVITY + 1) / SCALE) + 1;
  return coarse.map((line, y) => (y >= coarse.length - rows ? '.'.repeat(COLS) : line));
}

/**
 * Seals the bottom with steel, leaving the entrance open, and hangs a short
 * steel guard under the hole (never wider than the hole minus one cell, so a
 * straight shot always has a column to slip through).
 */
function sealFloor(lines, { x0, w }, guard) {
  const floor = Array.from({ length: GRID_COLS }, (_, x) => (x >= x0 && x < x0 + w ? '.' : 'S')).join('');
  const gw = Math.max(0, Math.min(guard, w - 1));
  const g0 = x0 + Math.floor((w - gw) / 2);
  const guardLine = Array.from({ length: GRID_COLS }, (_, x) => (x >= g0 && x < g0 + gw ? 'S' : '.')).join('');
  return [...lines.slice(0, -1), floor, ...Array(GUARD_GAP).fill('.'.repeat(GRID_COLS)), guardLine];
}

/** @returns {string} the name stage i is shown with (cheap: builds nothing) */
export const levelName = (i) => landmarkAt(Math.max(0, Math.floor(i))).name;

/**
 * Builds stage i (0, 1, 2, ... endless). Every stage is a landmark: the list
 * in order, then again at sunset and at night. All difficulty knobs, including
 * the entrance, come from stageParams(i).
 * @param {number} i
 */
export function getLevel(i) {
  const n = Math.max(0, Math.floor(i));
  const p = stageParams(n);
  const map = landmarkAt(n);
  const hole = entranceSpan(p, n);
  const coarse = carveLobby(map.build());
  const seeded = seedUnits(seedItems(coarse, p.items, p.bigItemShare, n + 101), p.unitTop, p.unitCount, n + 701);
  const lines = sealFloor(withGutter(upscale(seeded)), hole, p.guard);
  return {
    index: n,
    name: map.name,
    subtitle: map.subtitle,
    palette: map.palette,
    brickHp: p.brickHp,
    params: p,
    lines,
  };
}
