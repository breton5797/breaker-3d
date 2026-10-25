// Drawing kit for handcrafted maps: a coarse 48-wide char canvas that
// levels.js later upscales to the fine game grid.
import { mulberry32 } from './rng.js';

// Stages are designed on a coarse 48-wide grid (levels.js upscales them x2).
export const COLS = 48;

// ---------- tiny drawing kit for building levels as char canvases ----------

const MAX_LINES = 48;

export function canvas(h = MAX_LINES, ch = '.') {
  return Array.from({ length: h }, () => Array(COLS).fill(ch));
}
export function put(g, x, y, ch) {
  if (y >= 0 && y < g.length && x >= 0 && x < COLS) g[y][x] = ch;
}
export function rect(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, ch);
}
export function stamp(g, pattern, ox, oy, scale, map, scaleY = scale) {
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
export function channel(g, x, w = 3) {
  rect(g, x - 1, SHAFT_MOUTH, w + 2, g.length - SHAFT_MOUTH, 'S');
  rect(g, x, 0, w, g.length, '.');
}
export function sprinkle(g, rng, count, ch, where = (c) => c !== 'S') {
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
export const toLines = (g) => g.map((r) => r.join(''));

// ---------- shape painting for landmark murals ----------

export const CX = COLS / 2;

/** Paints every cell whose centre (x + 0.5, y + 0.5) makes fn return a char. */
export function paint(g, fn) {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = fn(x + 0.5, y + 0.5);
      if (ch) g[y][x] = ch;
    }
  }
}
/** Isosceles triangle: apex at (cx, top), half-width hw at y = bottom. */
export const inTri = (x, y, cx, top, bottom, hw) =>
  y >= top && y <= bottom && Math.abs(x - cx) <= ((y - top) / Math.max(1e-6, bottom - top)) * hw;
export const inRect = (x, y, x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
export const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/**
 * Scatters special blocks onto bricks of the given palette letters and returns
 * the finished lines. `specials` is a list of [char, count, letters].
 */
export function decorate(g, seed, specials) {
  const rng = mulberry32(seed * 977 + 5);
  for (const [ch, count, on] of specials) sprinkle(g, rng, count, ch, (c) => on.includes(c));
  return toLines(g);
}
