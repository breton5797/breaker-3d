import { COLS as GRID_COLS, ROWS, CELL, SPLIT_COUNT, SPLIT_USES, UNIT_TIERS, UNIT_CHARS } from './constants.js';

import { LEVELS, landmarkAt, bossAt, toLines } from './maps.js';
import { MAP_BOSSES, mapBossSpec } from './mapBosses.js';
import { stageSlot } from './sequence.js';

// Stages are designed on a coarse grid (maps.js), narrowed to fit the box, then
// upscaled SCALE times to the fine game grid.
const SCALE = 2;

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
  $: CELL.COIN,
};

/**
 * Parses text lines (top line = top of the field) into the cell grid.
 * Letters a-h are bricks with an explicit palette index; '#' bricks get a
 * stripe colour from their line.
 * @param {string[]} lines
 * @param {{ brickHp?: number, box?: object|null, holes?: object[] }} [opts] brickHp: hits a
 *   plain brick takes ('H' adds one more); box/holes: the steel box and its entrances (getLevel)
 */
export function parseLevel(lines, { brickHp = 1, box = null, holes = [] } = {}) {
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
  const floorRow = box ? box.bottom : findFloorRow(cells);
  return { cells, hp, color, tier, remaining, total: remaining, floorRow, box, holes };
}

/**
 * Lowest row that is mostly steel: the sealed floor, or -1 when there is none.
 * "Mostly" (3/4) so a few holes in it still count.
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

// Cells that stay a single fine cell when upscaling; the rest of their block becomes brick.
const SINGLE = new Set(['A', 'C', 'D', 'E', 'I', 'M', '$', 'B', '-', '|', 'G', 'F', '2', '3', '5', ...UNIT_CHARS]);

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
    const x = Math.floor(rng() * g[0].length);
    const y = Math.floor(rng() * g.length);
    if (isPlainBrick(g[y][x])) {
      g[y][x] = pickItem(rng, bigShare);
      placed++;
    }
  }
  return toLines(g);
}

/** Turns `count` random plain bricks into gold coin bricks ('$'). */
function seedCoins(lines, count, seed) {
  const rng = mulberry32(seed);
  const g = lines.map((l) => [...l]);
  let placed = 0;
  for (let tries = 0; placed < count && tries < 5000; tries++) {
    const x = Math.floor(rng() * g[0].length);
    const y = Math.floor(rng() * g.length);
    if (isPlainBrick(g[y][x])) {
      g[y][x] = '$';
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
    const x = Math.floor(rng() * g[0].length);
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

const CAVITY = 8; // empty fine rows kept above the box floor so an entering ball keeps going
const LANES = [1, 2]; // open fine columns between each side wall of the field and the box (owner: 1-2, random per stage)
const TOP_LANE = 6; // open fine rows between the ceiling and the box
const POCKET = 6; // fine cells kept clear behind every hole

/** @param {number} n stage index @returns {number} its side lane width (1 or 2), the same every time */
export const laneFor = (n) => LANES[Math.floor(mulberry32(n * 97 + 13)() * LANES.length)];
/** Fine columns inside a box with side lanes `lane` wide (the murals fill all of it). */
const innerCols = (lane) => GRID_COLS - 2 - 2 * lane;

/** The steel box for a stage of `lineCount` lines: wall columns and rows (inclusive). */
export const BOX = (lineCount, lane = LANES[0]) => ({ left: lane, right: lane + innerCols(lane) + 1, bottom: ROWS - lineCount, top: ROWS - 1 - TOP_LANE });

// Where holes can go. `at` runs left to right on the floor and ceiling, bottom
// to top on the side walls. odds = % of random serves that get in through that
// hole alone, for a two-ball and a one-ball hole (measured by scripts/slot-odds.mjs; the one-ball
// figures re-measured 2026-10-29 for the 1-2 cell side lanes, the only size stages use).
export const SLOTS = [
  { slot: 'bottom-l', side: 'bottom', at: 0.25, odds: [1.7, 0.8] },
  { slot: 'bottom-c', side: 'bottom', at: 0.5, odds: [2.03, 0.87] },
  { slot: 'bottom-r', side: 'bottom', at: 0.75, odds: [1.87, 0.58] },
  { slot: 'left-lo', side: 'left', at: 0.35, odds: [0.73, 0.28] },
  { slot: 'left-hi', side: 'left', at: 0.7, odds: [1.13, 0.3] },
  { slot: 'right-lo', side: 'right', at: 0.35, odds: [0.77, 0.25] },
  { slot: 'right-hi', side: 'right', at: 0.7, odds: [1.0, 0.33] },
  { slot: 'top-l', side: 'top', at: 0.3, odds: [0.93, 0.07] },
  { slot: 'top-r', side: 'top', at: 0.7, odds: [0.97, 0.12] },
  { slot: 'bl', side: 'bl', odds: [3.27, 1.45] },
  { slot: 'br', side: 'br', odds: [2.87, 1.42] },
  { slot: 'tl', side: 'tl', odds: [2.13, 0.18] },
  { slot: 'tr', side: 'tr', odds: [2.87, 0.37] },
];
const CEILING_SIDES = new Set(['top', 'tl', 'tr']); // slots only a ball up a side lane can reach
const FLOOR_UNTIL = 10; // before this stage one hole is always in the floor
const HARDEST_AT = 199; // from this stage on the hardest hole spots are used
const SPREAD = 0.04; // share of the ranking around the stage's spot to pick from (variety)

function combinations(list, k, from = 0, acc = [], out = []) {
  if (acc.length === k) { out.push(acc); return out; }
  for (let i = from; i <= list.length - (k - acc.length); i++) combinations(list, k, i + 1, [...acc, list[i]], out);
  return out;
}

/**
 * Picks this stage's hole slots. Every set of `count` slots is ranked from
 * easiest to hardest to get into (summed odds); stage n takes a set from the
 * point n / HARDEST_AT along that ranking, at random within a small window,
 * so the holes move to harder spots as stages rise while the walls still vary.
 * Early stages always keep a floor hole.
 */
function pickSlots(n, count, size, noCeiling = false) {
  const rng = mulberry32(n * 131 + 7);
  const odds = (set) => set.reduce((sum, s) => sum + s.odds[size === 2 ? 0 : 1], 0);
  const sets = combinations(SLOTS, count)
    .filter((set) => n >= FLOOR_UNTIL || set.some((s) => s.side === 'bottom'))
    // A big boss's short arena sits right under the boss: a ceiling hole there can't be reached.
    .filter((set) => !noCeiling || set.every((s) => s.side !== 'top'))
    // The side lanes are only 1-2 cells, so the ceiling side is reached by a random bounce
    // at best (lane-odds.mjs: 6-9x harder, never aimable): no holes up there.
    .filter((set) => set.every((s) => !CEILING_SIDES.has(s.side)))
    .map((set) => ({ set, odds: odds(set) }))
    .sort((a, b) => b.odds - a.odds);
  const at = Math.round(Math.min(1, n / HARDEST_AT) * (sets.length - 1));
  const half = Math.max(1, Math.round(sets.length * SPREAD));
  const lo = Math.max(0, at - half);
  const hi = Math.min(sets.length - 1, at + half);
  return sets[lo + Math.floor(rng() * (hi - lo + 1))].set;
}

/**
 * Geometry of one hole in fine coordinates: the wall cells it opens ([c, r]),
 * the direction into the box, and the interior pocket kept clear behind it
 * (interior columns ic, rows ir counted from the top).
 */
function holeGeometry({ slot, side, at }, size, box, innerRows) {
  const INNER = box.right - box.left - 1; // fine columns inside this box
  const rowOf = (ir) => box.top - 1 - ir; // interior row (from top) -> grid row
  const span = (a, len) => Math.round(a * len - size / 2);
  const range = (a, k) => Array.from({ length: k }, (_, i) => a + i);
  const clamp = (p) => ({
    ic0: Math.max(0, p.ic0), ic1: Math.min(INNER - 1, p.ic1), ir0: Math.max(0, p.ir0), ir1: Math.min(innerRows - 1, p.ir1),
  });
  if (side === 'bottom' || side === 'top') {
    const ic = span(at, INNER);
    const r = side === 'bottom' ? box.bottom : box.top;
    const cells = range(box.left + 1 + ic, size).map((c) => [c, r]);
    const ir0 = side === 'bottom' ? innerRows - POCKET : 0;
    return { slot, side, size, cells, inward: [0, side === 'bottom' ? 1 : -1], pocket: clamp({ ic0: ic - 1, ic1: ic + size, ir0, ir1: ir0 + POCKET - 1 }) };
  }
  if (side === 'left' || side === 'right') {
    const irTop = innerRows - 1 - span(at, innerRows) - (size - 1);
    const c = side === 'left' ? box.left : box.right;
    const cells = range(irTop, size).map((ir) => [c, rowOf(ir)]);
    const ic0 = side === 'left' ? 0 : INNER - POCKET;
    return { slot, side, size, cells, inward: [side === 'left' ? 1 : -1, 0], pocket: clamp({ ic0, ic1: ic0 + POCKET - 1, ir0: irTop - 1, ir1: irTop + size }) };
  }
  // Corners: the corner cell plus `size` cells along each wall, so a ball can slip in diagonally.
  const left = side[1] === 'l';
  const low = side[0] === 'b';
  const c = left ? box.left : box.right;
  const r = low ? box.bottom : box.top;
  const dc = left ? 1 : -1;
  const dr = low ? 1 : -1;
  const cells = [[c, r], ...range(1, size).map((k) => [c + dc * k, r]), ...range(1, size).map((k) => [c, r + dr * k])];
  const ic0 = left ? 0 : INNER - POCKET;
  const ir0 = low ? innerRows - POCKET : 0;
  return { slot, side, size, cells, inward: [dc, dr], pocket: clamp({ ic0, ic1: ic0 + POCKET - 1, ir0, ir1: ir0 + POCKET - 1 }) };
}

/** Rank for narrowing: specials survive over steel, steel over bricks, bricks over air. */
const rank = (ch) => (ch === '.' ? 0 : ch === 'S' ? 2 : isPlainBrick(ch) || ch === 'H' ? 1 : 3);

/** Squeezes a 48-wide mural into `width` columns, keeping thin details (each target column keeps its strongest source cell). */
function narrow(lines, width) {
  return lines.map((line) => Array.from({ length: width }, (_, j) => {
    const a = Math.floor((j * line.length) / width);
    const b = Math.max(a + 1, Math.floor(((j + 1) * line.length) / width));
    let best = line[a];
    for (let k = a + 1; k < b; k++) if (rank(line[k]) > rank(best)) best = line[k];
    return best;
  }).join(''));
}

/**
 * Draws the mural with thicker outlines: every open cell right beside a plain
 * brick (left, right, above or below) takes that brick's colour. More bricks, same picture;
 * the sky above stays open and steel/special blocks stay single.
 * @param {string[]} lines coarse rows
 * @returns {string[]}
 */
export function thicken(lines) {
  return lines.map((line, y) => [...line].map((ch, x) => {
    if (ch !== '.') return ch;
    const near = [line[x - 1], line[x + 1], lines[y - 1]?.[x], lines[y + 1]?.[x]];
    return near.find((n) => n && isPlainBrick(n)) ?? ch;
  }).join(''));
}

/** Clears the bottom coarse rows (a lobby along the floor) and every hole pocket. */
function carveOpenings(coarse, holes) {
  const lobby = Math.ceil((CAVITY + 1) / SCALE) + 1;
  const g = coarse.map((line, y) => (y >= coarse.length - lobby ? [...'.'.repeat(line.length)] : [...line]));
  for (const { pocket: p } of holes) {
    for (let y = Math.floor(p.ir0 / SCALE); y <= Math.floor(p.ir1 / SCALE); y++) {
      for (let x = Math.floor(p.ic0 / SCALE); x <= Math.floor(p.ic1 / SCALE); x++) g[y][x] = '.';
    }
  }
  return toLines(g);
}

/** Wraps the fine interior in a steel box with open lanes around it, then opens the holes. */
function frame(inner, box, holes) {
  const lane = '.'.repeat(box.left);
  const wall = `${lane}${'S'.repeat(box.right - box.left + 1)}${lane}`;
  const rows = [
    ...Array(TOP_LANE).fill('.'.repeat(GRID_COLS)),
    wall,
    ...inner.map((line) => `${lane}S${line}S${lane}`),
    wall,
  ].map((line) => [...line]);
  for (const h of holes) for (const [c, r] of h.cells) rows[ROWS - 1 - r][c] = '.';
  return toLines(rows);
}

/** @returns {string} the name stage i is shown with (cheap: builds nothing) */
/** A safe stage index: anything not a finite number counts as the first stage. */
const stageIndex = (i) => (Number.isFinite(i) ? Math.max(0, Math.floor(i)) : 0);

export const levelName = (i) => {
  const slot = stageSlot(stageIndex(i));
  return (slot.boss ? bossAt(slot.bossIndex) : landmarkAt(slot.content)).name;
};

/**
 * Builds stage i (0, 1, 2, ... endless). Every stage is a landmark inside a
 * steel box: the list in order, then again at sunset and at night. The holes
 * (how many, how big, on which walls) and every other knob come from stageParams(i).
 * @param {number} i
 * @param {{ slots?: string[], lane?: number }} [opts] force these hole slots or this side lane width (balance scripts and tests)
 */
/** Boss toughness and attack strength rise with the stage. */
const bossSpec = (kind, n) => ({
  kind,
  hp: 140 + Math.floor(n * 1.5),
  dps: 6 + Math.floor(n / 30), // damage per second it can take: fights last ~25 s however big the swarm
  tier: Math.min(10, 2 + Math.floor(n / 25)), // stun (and later lethal) strength of its attacks
});

export function getLevel(i, { slots, lane: forcedLane } = {}) {
  const n = stageIndex(i);
  const p = stageParams(n);
  const slot = stageSlot(n);
  const map = slot.boss ? bossAt(slot.bossIndex) : landmarkAt(slot.content);
  const lane = forcedLane ?? laneFor(n);
  const mural = thicken(narrow(map.build(), innerCols(lane) / SCALE));
  const innerRows = mural.length * SCALE;
  const box = BOX(TOP_LANE + innerRows + 2, lane);
  const chosen = slots ? slots.map((name) => SLOTS.find((s) => s.slot === name)) : pickSlots(n, p.holeCount, p.holeSize, slot.boss);
  const holes = chosen.map((s) => holeGeometry(s, p.holeSize, box, innerRows));
  const coarse = carveOpenings(mural, holes);
  const fed = seedCoins(seedItems(coarse, p.items, p.bigItemShare, n + 101), p.coins, n + 401);
  // A boss does the shooting itself, so its stage has no enemy units.
  const seeded = slot.boss ? fed : seedUnits(fed, p.unitTop, p.unitCount, n + 701);
  const lines = frame(upscale(seeded), box, holes);
  const bricks = lines.reduce((sum, line) => sum + [...line].filter((ch) => ch !== '.' && ch !== 'S').length, 0);
  return {
    index: n,
    name: map.name,
    subtitle: map.subtitle,
    palette: map.palette,
    photo: map.photo === null ? null : map.id,
    photoTint: map.photoTint,
    brickHp: p.brickHp,
    params: p,
    lines,
    box,
    holes: holes.map(({ pocket, ...h }) => h),
    // Every stage has a boss: the big one on every 10th, the map's own otherwise.
    boss: slot.boss ? bossSpec(map.id, n) : mapBossSpec(map.id, n, bricks),
    bricks,
    bossName: slot.boss ? map.name : `BOSS · ${MAP_BOSSES[map.id]?.name ?? map.name}`,
    bossStage: slot.boss,
    theme: map.theme ?? null, // chapter gimmick: 'space' | 'sea' | 'nature' (gimmicks.js)
    chapterStart: Boolean(map.chapterStart),
  };
}
