import { COLS, ROWS, CELL, SPLIT_COUNT, SPLIT_USES } from './constants.js';
import { mulberry32 } from './rng.js';

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
};

/**
 * Parses text lines (top line = top of the field) into the cell grid.
 * Letters a-h are bricks with an explicit palette index; '#' bricks get a
 * stripe colour from their line.
 * @param {string[]} lines
 */
export function parseLevel(lines) {
  const size = COLS * ROWS;
  const cells = new Uint8Array(size);
  const hp = new Uint8Array(size);
  const color = new Uint8Array(size);
  let remaining = 0;
  lines.forEach((line, li) => {
    const r = ROWS - 1 - li;
    if (r < 0) return;
    for (let c = 0; c < Math.min(COLS, line.length); c++) {
      const ch = line[c];
      const code = ch.charCodeAt(0);
      const isLetter = code >= 97 && code <= 104; // a-h
      const type = isLetter ? CELL.BRICK : CHAR_CELL[ch];
      if (!type) continue;
      const i = r * COLS + c;
      cells[i] = type;
      hp[i] = SPLIT_COUNT[type] ? SPLIT_USES : ch === 'H' ? 2 : 1;
      color[i] = isLetter ? code - 97 : Math.floor(li / 5) % 8;
      if (type !== CELL.STEEL) remaining++;
    }
  });
  return { cells, hp, color, remaining, total: remaining };
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
function channel(g, x, w = 3) {
  rect(g, x - 1, 0, w + 2, g.length, 'S');
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

const GUTTER = 3; // empty rows under the ceiling where escaped balls go wild
const withGutter = (lines) => [...Array(GUTTER).fill('.'.repeat(COLS)), ...lines].slice(0, ROWS - 14);

/**
 * Drops multiplier gates onto plain bricks in the lowest band of the wall so
 * the very first shots can start the chain reaction.
 */
function seedGates(lines, count, seed) {
  const g = lines.map((l) => [...l]);
  const rng = mulberry32(seed);
  const solidLines = g.map((row, y) => (row.some((ch) => ch !== '.') ? y : -1)).filter((y) => y >= 0);
  const bottom = Math.max(...solidLines);
  const band = (c, x, y) => y > bottom - 12 && (c === '#' || (c >= 'a' && c <= 'h'));
  let placed = 0;
  for (let tries = 0; placed < count && tries < 5000; tries++) {
    const x = Math.floor(rng() * COLS);
    const y = Math.floor(rng() * g.length);
    if (band(g[y][x], x, y)) {
      g[y][x] = rng() < 0.75 ? '2' : '3';
      placed++;
    }
  }
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
  const cx = 23.5, cy = 22, R = 21;
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

function procedural(seed) {
  const rng = mulberry32(seed * 7919 + 13);
  const h = 34 + Math.floor(rng() * 12);
  const g = canvas(h, '#');
  for (let k = 0; k < 3 + Math.floor(rng() * 5); k++) {
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
  { name: 'T 터널', subtitle: '통로를 뚫고 들어가 분열시켜라', palette: PALETTES.red, build: tunnelT },
  { name: '하트 폭탄', subtitle: '사랑은 연쇄 폭발', palette: PALETTES.pink, build: heartBombs },
  { name: '스마일', subtitle: '웃는 얼굴을 불태워라', palette: PALETTES.lemon, build: smiley },
  { name: '레이저 피라미드', subtitle: '층마다 레이저가 숨어 있다', palette: PALETTES.rainbow, build: pyramid },
  { name: '연쇄 반응', subtitle: '하나가 터지면 전부 터진다', palette: PALETTES.sunset, build: chainReaction, gates: 24 },
  { name: 'W O W', subtitle: '끝에 남는 것은?', palette: PALETTES.neon, build: wow },
  { name: '나선 미로', subtitle: '강철 소용돌이의 중심으로', palette: PALETTES.ocean, build: spiral },
  { name: '더 월', subtitle: '2,300개의 벽돌', palette: PALETTES.mint, build: theWall },
];

/** @param {number} i zero-based stage index; beyond the handcrafted list stages are procedural */
export function getLevel(i) {
  if (i < LEVELS.length) {
    const l = LEVELS[i];
    return { index: i, name: l.name, subtitle: l.subtitle, palette: l.palette, lines: withGutter(seedGates(l.build(), l.gates ?? 12, i + 101)) };
  }
  const keys = Object.keys(PALETTES);
  return {
    index: i,
    name: `무한 ${i - LEVELS.length + 1}`,
    subtitle: '끝없는 벽',
    palette: PALETTES[keys[i % keys.length]],
    lines: withGutter(seedGates(procedural(i), 12, i + 101)),
  };
}
