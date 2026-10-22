import { COLS as GRID_COLS, ROWS, CELL, SPLIT_COUNT, SPLIT_USES, UNIT_TIERS, UNIT_CHARS } from './constants.js';

// Stages are designed on a coarse 48-wide grid, then upscaled x2 to the fine game grid.
const COLS = 48;
const SCALE = GRID_COLS / COLS;
import { mulberry32 } from './rng.js';
import { stageParams, STAGE_COUNT } from './stages.js';

export { stageParams, STAGE_COUNT };

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

/** Lowest row that is (almost) all steel: the sealed floor, or -1 when there is none. */
function findFloorRow(cells) {
  for (let r = 0; r < ROWS; r++) {
    let steel = 0;
    for (let c = 0; c < GRID_COLS; c++) if (cells[r * GRID_COLS + c] === CELL.STEEL) steel++;
    if (steel >= GRID_COLS - 3) return r;
  }
  return -1;
}

// ---------- tiny drawing kit for building levels as char canvases ----------

const MAX_LINES = 48;

function canvas(h = MAX_LINES, ch = '.') {
  return Array.from({ length: h }, () => Array(COLS).fill(ch));
}
function put(g, x, y, ch) {
  if (y >= 0 && y < g.length && x >= 0 && x < COLS) g[y][x] = ch;
}
function rect(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, ch);
}
function stamp(g, pattern, ox, oy, scale, map, scaleY = scale) {
  pattern.forEach((row, j) => {
    [...row].forEach((p, i) => {
      const ch = map[p];
      if (ch) rect(g, ox + i * scale, oy + j * scaleY, scale, scaleY, ch);
    });
  });
}
/** Steel-lined vertical shaft from the bottom of the wall to the ceiling gutter. */
const SHAFT_MOUTH = 4; // top rows where the shaft is flanked by bricks, not steel

/**
 * Vertical shaft from the bottom of the wall to the ceiling gutter. Its steel
 * lining stops short of the top so balls leaving the mouth bite into bricks.
 */
function channel(g, x, w = 3) {
  rect(g, x - 1, SHAFT_MOUTH, w + 2, g.length - SHAFT_MOUTH, 'S');
  rect(g, x, 0, w, g.length, '.');
}
function sprinkle(g, rng, count, ch, where = (c) => c !== 'S') {
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 50; tries++) {
    const x = Math.floor(rng() * COLS);
    const y = Math.floor(rng() * g.length);
    if (where(g[y][x])) {
      g[y][x] = ch;
      placed++;
    }
  }
}
const toLines = (g) => g.map((r) => r.join(''));

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
 * Hides `count` enemy units inside the wall: one of tier `top`, the rest within
 * three tiers below it.
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
    const tier = placed === 0 ? top : Math.max(1, top - Math.floor(rng() * 4));
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

// ---------- handcrafted stages ----------

function tunnelT() {
  const g = canvas(46, '#');
  rect(g, 6, 2, 36, 7, 'H'); // T crossbar frame
  rect(g, 20, 8, 8, 38, 'H'); // T stem frame
  rect(g, 7, 3, 34, 5, '.');
  rect(g, 21, 8, 6, 38, '.');
  [[10, 4, '2'], [16, 5, '3'], [24, 4, '5'], [31, 5, '3'], [37, 4, '2']].forEach(([x, y, c]) => put(g, x, y, c));
  return toLines(g);
}

const HEART = [
  '..###...###..',
  '.#####.#####.',
  '#############',
  '#############',
  '#############',
  '.###########.',
  '..#########..',
  '...#######...',
  '....#####....',
  '.....###.....',
  '......#......',
];
function heartBombs() {
  const g = canvas(40);
  stamp(g, HEART, 4, 2, 3, { '#': 'a' });
  const rng = mulberry32(11);
  sprinkle(g, rng, 14, 'B', (c) => c === 'a');
  sprinkle(g, rng, 6, '2', (c) => c === 'a');
  put(g, 23, 34, '3');
  rect(g, 0, 39, COLS, 1, 'H');
  return toLines(g);
}

function spiral() {
  const g = canvas(46, '#');
  // Concentric steel rings; each has one gap, alternating bottom/top, so the
  // ball has to snake inward ring by ring.
  for (let k = 0, x0 = 1, y0 = 1, x1 = COLS - 2, y1 = 44; x1 - x0 > 6 && y1 - y0 > 6; k++) {
    rect(g, x0, y0, x1 - x0 + 1, 1, 'S');
    rect(g, x0, y1, x1 - x0 + 1, 1, 'S');
    rect(g, x0, y0, 1, y1 - y0 + 1, 'S');
    rect(g, x1, y0, 1, y1 - y0 + 1, 'S');
    const gapX = k % 2 === 0 ? 22 : (k % 4 === 1 ? x1 - 7 : x0 + 2);
    rect(g, gapX, k % 2 === 0 ? y1 : y0, 6, 1, '#');
    x0 += 5; y0 += 5; x1 -= 5; y1 -= 5;
  }
  const rng = mulberry32(5);
  sprinkle(g, rng, 16, '3', (c) => c === '#');
  sprinkle(g, rng, 6, 'F', (c) => c === '#');
  sprinkle(g, rng, 6, 'B', (c) => c === '#');
  return toLines(g);
}

function chainReaction() {
  const g = canvas(44, '#');
  // A snaking fuse of bombs 3 apart: one hit cascades along the whole wall.
  for (let y = 4; y < 44; y += 9) for (let x = 2; x < COLS - 1; x += 3) put(g, x, y, 'B');
  for (let y = 4; y < 40; y += 3) put(g, Math.floor(y / 9) % 2 === 0 ? COLS - 2 : 2, y, 'B');
  rect(g, 0, 41, COLS, 1, '-');
  channel(g, 22);
  put(g, 10, 20, '|');
  put(g, 37, 20, '|');
  return toLines(g);
}

function smiley() {
  const g = canvas(46);
  const cx = 23.5, cy = 20, R = 19;
  for (let y = 0; y < 46; y++) for (let x = 0; x < COLS; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < R) put(g, x, y, d > R - 1 ? 'H' : 'b');
  }
  rect(g, 14, 12, 5, 7, 'B');
  rect(g, 29, 12, 5, 7, 'B');
  for (let x = 12; x <= 35; x++) put(g, x, Math.round(26 + 7 * Math.sin(((x - 12) / 23) * Math.PI)), 'F');
  put(g, 23, 40, '5');
  return toLines(g);
}

const FONT = {
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  O: ['.###.', '#ooo#', '#ooo#', '#ooo#', '.###.'], // o = hollow, nothing sealed inside
};
function wow() {
  const g = canvas(44, '#');
  // Narrow letters (2x wide, 3x tall) leave 6-cell corridors so balls can climb past them.
  ['W', 'O', 'W'].forEach((ch, i) => stamp(g, FONT[ch], 3 + i * 16, 8, 2, { '#': 'S', o: '.' }, 3));
  channel(g, 15, 2);
  channel(g, 31, 2);
  const rng = mulberry32(3);
  sprinkle(g, rng, 9, '2', (c) => c === '#');
  sprinkle(g, rng, 4, '5', (c) => c === '#');
  sprinkle(g, rng, 5, 'G', (c) => c === '#');
  return toLines(g);
}

function pyramid() {
  const g = canvas(46);
  for (let s = 0; s < 11; s++) {
    const y = 4 + s * 4;
    rect(g, 23 - s * 2, y, 2 + s * 4, 4, String.fromCharCode(97 + (s % 8)));
    if (s % 2 === 1) put(g, 23 - s * 2, y + 1, '-');
    if (s % 3 === 2) put(g, 24 + s * 2, y + 2, '-');
  }
  put(g, 23, 5, '5');
  put(g, 12, 40, '3');
  put(g, 35, 40, '3');
  put(g, 23, 44, 'F');
  return toLines(g);
}

function theWall() {
  const g = canvas(45, '#');
  channel(g, 6, 2);
  channel(g, 39, 2);
  const rng = mulberry32(2026);
  sprinkle(g, rng, 6, '5');
  sprinkle(g, rng, 10, '3');
  sprinkle(g, rng, 8, 'B');
  sprinkle(g, rng, 4, '|');
  sprinkle(g, rng, 6, 'G');
  return toLines(g);
}

function procedural(seed, d = 0) {
  const rng = mulberry32(seed * 7919 + 13);
  const h = 34 + Math.floor(rng() * 12);
  const g = canvas(h, '#');
  for (let k = 0; k < 3 + Math.floor(rng() * 5 + d * 8); k++) {
    const w = 3 + Math.floor(rng() * 14);
    rect(g, Math.floor(rng() * COLS), Math.floor(rng() * h), w, 1 + Math.floor(rng() * 3), rng() < 0.5 ? 'S' : '.');
  }
  sprinkle(g, rng, 4 + Math.floor(rng() * 8), '2');
  sprinkle(g, rng, 2 + Math.floor(rng() * 6), '3');
  sprinkle(g, rng, 1 + Math.floor(rng() * 3), '5');
  sprinkle(g, rng, 3 + Math.floor(rng() * 10), 'B');
  sprinkle(g, rng, Math.floor(rng() * 4), '-');
  sprinkle(g, rng, Math.floor(rng() * 4), 'F');
  sprinkle(g, rng, 2, 'G');
  channel(g, 4 + Math.floor(rng() * 38));
  return toLines(g);
}

const PALETTES = {
  red: ['#e2453c', '#d93a33', '#ef5a3f', '#c9302c', '#f06a4a', '#d4473a', '#e85d3c', '#b8322c'],
  pink: ['#ff5c9a', '#ff7ab0', '#e0447f', '#ff92c2', '#c93a72', '#ff6aa6', '#f04f8f', '#d33d79'],
  ocean: ['#2bb5ff', '#36d1dc', '#3a8dff', '#5ad8ff', '#2878e8', '#4fc3f7', '#1fa2ff', '#62e0ff'],
  sunset: ['#ff9f1c', '#ff6b6b', '#ffbf69', '#f25f5c', '#ffd166', '#ef476f', '#ffa94d', '#ff7b54'],
  lemon: ['#ffd23f', '#ffcc1a', '#f7b801', '#ffe066', '#f4a259', '#ffd447', '#ffc300', '#ffe45c'],
  neon: ['#b388ff', '#7c4dff', '#ea80fc', '#651fff', '#d500f9', '#9575cd', '#e040fb', '#8c9eff'],
  rainbow: ['#ff4d4d', '#ff9f43', '#feca57', '#1dd1a1', '#48dbfb', '#2e86de', '#a55eea', '#ff6b81'],
  mint: ['#00d2a0', '#1de9b6', '#00bfa5', '#64ffda', '#26a69a', '#00e5ff', '#18ffff', '#4db6ac'],
};

export const LEVELS = [
  { name: 'T 터널', subtitle: '통로 끝 좁은 구멍으로 공을 넣어라', palette: PALETTES.red, build: tunnelT },
  { name: '하트 폭탄', subtitle: '하트 아래 틈을 노려라', palette: PALETTES.pink, build: heartBombs },
  { name: '스마일', subtitle: '웃는 얼굴 밑, 작은 구멍', palette: PALETTES.lemon, build: smiley },
  { name: '레이저 피라미드', subtitle: '구석의 틈을 찾아라', palette: PALETTES.rainbow, build: pyramid },
  { name: '연쇄 반응', subtitle: '하나가 터지면 전부 터진다', palette: PALETTES.sunset, build: chainReaction },
  { name: 'W O W', subtitle: '갱도를 타고 올라가라', palette: PALETTES.neon, build: wow },
  { name: '나선 미로', subtitle: '강철 소용돌이의 중심으로', palette: PALETTES.ocean, build: spiral },
  { name: '더 월', subtitle: '구멍 하나, 벽돌 7,000개', palette: PALETTES.mint, build: theWall },
];

const PROC_NAMES = ['미궁', '요새', '성벽', '협곡', '탑', '동굴', '벌집', '격자', '광산', '방벽'];
const finish = (coarse, holeW) => withGutter(sealFloor(upscale(coarse), holeW));

/**
 * Builds stage i (0..199). Stages 1-8 are the handcrafted set; after that every
 * third stage revisits a handcrafted layout and the rest are procedural. All
 * difficulty knobs come from stageParams(i).
 * @param {number} i
 */
export function getLevel(i) {
  const n = Math.max(0, Math.min(STAGE_COUNT - 1, i));
  const p = stageParams(n);
  const d = n / (STAGE_COUNT - 1);
  const keys = Object.keys(PALETTES);
  const crafted = n < LEVELS.length ? LEVELS[n] : n % 3 === 0 ? LEVELS[(n / 3) % LEVELS.length] : null;
  const coarse = crafted ? crafted.build() : procedural(n, d);
  const seeded = seedUnits(seedItems(coarse, p.items, p.bigItemShare, n + 101), p.unitTop, p.unitCount, n + 701);
  return {
    index: n,
    name: crafted ? crafted.name : `${PROC_NAMES[n % PROC_NAMES.length]} ${n + 1}`,
    subtitle: crafted ? crafted.subtitle : '벽 속 아이템을 노려라',
    palette: crafted ? crafted.palette : PALETTES[keys[n % keys.length]],
    brickHp: p.brickHp,
    params: p,
    lines: finish(seeded, p.holeW),
  };
}
