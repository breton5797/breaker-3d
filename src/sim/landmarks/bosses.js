// Boss arenas (every 10th stage). The boss itself is a moving creature
// (sim/boss.js, render/boss3d.js); its arena keeps bricks only in the lower
// part, so fruit and coins can still grow the swarm while the upper half
// stays open for the boss to roam. Same canvas and palette letters as the
// landmarks: c ground, d-h the terrain.
import { canvas, paint, rect, inEllipse, decorate } from '../mapkit.js';
import { H } from './ancient.js';

const TERRAIN_TOP = 29; // coarse rows above this stay empty: the boss's airspace

/** Desert ruins under the Stone Colossus: dunes and broken column stumps. */
export function colossus() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 37 + 2 * Math.sin(x / 5) ? 'c' : null));
  [4, 12, 20, 28, 36, 43].forEach((x, k) => rect(g, x, TERRAIN_TOP + 3 + (k % 3), 3, 12, k % 2 ? 'd' : 'e'));
  rect(g, 2, TERRAIN_TOP + 2, 9, 1, 'f');
  rect(g, 34, TERRAIN_TOP + 3, 9, 1, 'f');
  return decorate(g, 911, [['B', 4, 'd'], ['-', 4, 'c'], ['F', 2, 'e']]);
}

/** The Kraken's seabed: rocks, coral fans and swaying kelp. */
export function kraken() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 39 - 1.5 * Math.sin(x / 3) ? 'c' : null));
  [[8, 38, 6, 4], [24, 39, 8, 4], [40, 38, 6, 5]].forEach(([cx, cy, rx, ry]) => paint(g, (x, y) => (inEllipse(x, y, cx, cy, rx, ry) ? 'd' : null)));
  [3, 15, 31, 45].forEach((kx, k) => paint(g, (x, y) => (y >= TERRAIN_TOP + 2 && Math.abs(x - kx - Math.sin(y / 2 + k) * 1.2) < 0.9 ? 'e' : null)));
  [[12, 34], [35, 33]].forEach(([cx, cy]) => paint(g, (x, y) => (inEllipse(x, y, cx, cy, 3, 3) && y < cy + 1 ? 'f' : null)));
  return decorate(g, 912, [['B', 3, 'd'], ['|', 4, 'e'], ['F', 2, 'f']]);
}

/** The Lava Golem's field: black rock crust split by glowing-orange seams (matte). */
export function golem() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= TERRAIN_TOP + 4 + 2 * Math.abs(Math.sin(x / 6)) ? 'd' : null));
  paint(g, (x, y) => (y >= TERRAIN_TOP + 6 && Math.abs(((x * 0.6 + y * 1.3) % 10) - 5) < 0.55 ? 'h' : null));
  [[6, 31], [22, 30], [39, 32]].forEach(([cx, cy]) => paint(g, (x, y) => (inEllipse(x, y, cx, cy, 3.5, 2.5) ? 'e' : null)));
  paint(g, (x, y) => (y >= 41 ? 'c' : null));
  return decorate(g, 913, [['B', 5, 'd'], ['F', 3, 'h'], ['-', 3, 'e']]);
}

/** The Mothership hovers over a small city: blocks of towers with lit windows. */
export function mothership() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 41 ? 'c' : null));
  [[1, 32, 5], [7, 35, 4], [12, 30, 6], [19, 34, 5], [25, 31, 6], [32, 36, 4], [37, 30, 5], [43, 34, 4]].forEach(([x, top, w], k) => {
    rect(g, x, top, w, 41 - top, k % 2 ? 'd' : 'e');
    for (let y = top + 1; y < 40; y += 2) for (let i = x + 1; i < x + w - 1; i += 2) g[y][i] = 'h';
  });
  return decorate(g, 914, [['B', 3, 'd'], ['|', 5, 'e'], ['F', 2, 'g']]);
}
