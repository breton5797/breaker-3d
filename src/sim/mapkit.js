// Drawing kit for handcrafted maps: a coarse 48-wide char canvas that
// levels.js later upscales to the fine game grid.

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
