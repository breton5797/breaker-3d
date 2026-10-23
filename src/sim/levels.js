import { COLS as GRID_COLS, ROWS, CELL, SPLIT_COUNT, SPLIT_USES, UNIT_TIERS, UNIT_CHARS } from './constants.js';

import { COLS, LEVELS, PALETTES, procedural, toLines } from './maps.js';

// Stages are designed on a coarse grid (maps.js), then upscaled to the fine game grid.
const SCALE = GRID_COLS / COLS;

export { LEVELS };
import { mulberry32 } from './rng.js';
import { stageParams, BASE_RATE, PACE_WORK } from './stages.js';

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
 * "Mostly" (3/4) because beginner stages cut a hole up to 14 cells wide.
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

const CAVITY = 8; // empty cells needed above the hole so an entering ball keeps going

/**
 * Seals the bottom of the stage with steel, leaving one hole `holeW` wide under
 * the window with the most open space above it (a shaft or a chamber),
 * preferring the centre.
 */
function sealFloor(lines, holeW) {
  const g = lines.map((l) => [...l]);
  const floor = g.length - 1;
  const run = (x) => {
    let n = 0;
    for (let y = floor - 1; y >= 0 && g[y][x] === '.' && n < CAVITY; y--) n++;
    return n;
  };
  const off = (x) => Math.abs(x + holeW / 2 - GRID_COLS / 2);
  let best = Math.floor((GRID_COLS - holeW) / 2);
  let bestOpen = -1;
  for (let x = 0; x + holeW <= GRID_COLS; x++) {
    let open = 0;
    for (let k = 0; k < holeW; k++) if (run(x + k) >= CAVITY) open++;
    if (open > bestOpen || (open === bestOpen && off(x) < off(best))) { best = x; bestOpen = open; }
  }
  g[floor] = Array.from({ length: GRID_COLS }, (_, x) => (x >= best && x < best + holeW ? '.' : 'S'));
  return toLines(g);
}

/** Brick-hits needed to grind the whole wall (plain bricks x hp, 'H' one more). */
function wallWork(lines, brickHp) {
  let work = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === 'H') work += brickHp + 1;
      else if (isPlainBrick(ch)) work += brickHp;
    }
  }
  return work;
}

/** Release speed scaled to the wall so small and big stages pace alike. */
// `pace` corrects for layout shape: open, compact walls (smiley, pyramid) are
// mown much faster than mazes of letters, so they release balls more slowly.
const paceRate = (work, pace) => Math.round(Math.min(8, Math.max(0.5, BASE_RATE * pace * Math.pow(work / PACE_WORK, 1.3))) * 2) / 2;
const PROC_PACE = 0.8;

const PROC_NAMES = ['미궁', '요새', '성벽', '협곡', '탑', '동굴', '벌집', '격자', '광산', '방벽'];
const finish = (coarse, holeW) => withGutter(sealFloor(upscale(coarse), holeW));

/**
 * Builds stage i (0, 1, 2, ... endless). The handcrafted maps come first; after
 * that every other stage revisits one and the rest are procedural. All
 * difficulty knobs come from stageParams(i).
 * @param {number} i
 */
export function getLevel(i) {
  const n = Math.max(0, Math.floor(i));
  const p = stageParams(n);
  const d = Math.min(1, n / 199); // obstacle density for procedural walls
  const keys = Object.keys(PALETTES);
  // Handcrafted maps first (in order), then every other stage revisits one.
  const crafted = n < LEVELS.length ? LEVELS[n] : n % 2 === 0 ? LEVELS[(n / 2) % LEVELS.length] : null;
  const coarse = crafted ? crafted.build() : procedural(n, d);
  // Fruit count follows the wall size (small walls need fewer to finish on
  // time); open-chamber layouts leak balls back out of the hole, so they get more.
  // Tiny open walls (the pyramid) take an extra hit per brick to last as long as the rest.
  const brickHp = p.brickHp + (crafted?.hpBonus ?? 0);
  const size = Math.min(1.2, Math.max(0.3, Math.pow(wallWork(upscale(coarse), brickHp) / PACE_WORK, 1.5)));
  const items = Math.round(p.items * size * (crafted?.itemBoost ?? 1));
  const seeded = seedUnits(seedItems(coarse, items, p.bigItemShare, n + 101), p.unitTop, p.unitCount, n + 701);
  const lines = finish(seeded, p.holeW);
  return {
    index: n,
    name: crafted ? crafted.name : `${PROC_NAMES[Math.floor(n / 2) % PROC_NAMES.length]} ${n + 1}`,
    subtitle: crafted ? crafted.subtitle : '벽 속 아이템을 노려라',
    palette: crafted ? crafted.palette : PALETTES[keys[n % keys.length]],
    brickHp,
    params: { ...p, brickHp, items, releaseRate: paceRate(wallWork(lines, brickHp), crafted ? crafted.pace ?? 1 : PROC_PACE) },
    lines,
  };
}
