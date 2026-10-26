// Boss murals (every 10th stage): original giant creatures, each with a 3x3
// core 'X' at its heart. While the core lives its armour grows back (boss.js).
// Same canvas and palette letters as the landmarks: c ground, d-h the creature.
import { canvas, paint, rect, inRect, inEllipse, decorate } from '../mapkit.js';
import { H } from './ancient.js';

const core = (g, x, y) => rect(g, x, y, 3, 3, 'X');

/** Stone Colossus: an ancient carved giant rising from the sand, its heart a glowing core. */
export function colossus() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 40 ? 'c' : null));
  rect(g, 18, 8, 12, 9, 'e'); // head
  rect(g, 20, 11, 3, 2, 'h'); // eyes
  rect(g, 25, 11, 3, 2, 'h');
  rect(g, 21, 15, 6, 1, 'g'); // mouth
  rect(g, 16, 6, 16, 2, 'f'); // crown
  rect(g, 22, 17, 4, 2, 'd'); // neck
  rect(g, 10, 19, 28, 4, 'f'); // shoulders
  rect(g, 13, 23, 22, 15, 'd'); // chest
  paint(g, (x, y) => (inRect(x, y, 13, 23, 22, 15) && (Math.floor(x) + Math.floor(y)) % 7 === 0 ? 'g' : null)); // cracks
  rect(g, 5, 21, 6, 14, 'e'); // arms
  rect(g, 37, 21, 6, 14, 'e');
  rect(g, 4, 35, 8, 4, 'f'); // fists
  rect(g, 36, 35, 8, 4, 'f');
  core(g, 22, 27);
  return decorate(g, 901, [['B', 4, 'd'], ['-', 4, 'f'], ['F', 2, 'e']]);
}

/** Kraken: a colossal squid rising from the abyss, one great eye as its core. */
export function kraken() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 41 ? 'c' : null));
  paint(g, (x, y) => (inEllipse(x, y, 24, 14, 11, 9) ? 'd' : null)); // mantle
  paint(g, (x, y) => (inEllipse(x, y, 24, 7, 6, 4) ? 'f' : null)); // fin crest
  paint(g, (x, y) => (inEllipse(x, y, 24, 17, 4, 3) ? 'h' : null)); // eye socket
  // Eight tentacles curling down and outward.
  for (let k = 0; k < 8; k++) {
    const base = 14 + k * 2.9;
    paint(g, (x, y) => {
      if (y < 21 || y > 40) return null;
      const t = (y - 21) / 19;
      const cx = base + (base - 24) * t * 1.4 + Math.sin(t * 6 + k) * 2.2;
      return Math.abs(x - cx) <= 1.3 - t * 0.5 ? (k % 2 ? 'e' : 'g') : null;
    });
  }
  core(g, 23, 16);
  return decorate(g, 902, [['B', 3, 'd'], ['|', 4, 'e'], ['F', 2, 'g']]);
}

/** Lava Golem: a hulking rock giant with molten seams, its burning heart the core. */
export function golem() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 40 ? 'c' : null));
  paint(g, (x, y) => (inEllipse(x, y, 24, 12, 6, 5) ? 'e' : null)); // head
  paint(g, (x, y) => (inEllipse(x, y, 24, 27, 13, 11) ? 'd' : null)); // body
  paint(g, (x, y) => (inEllipse(x, y, 9, 24, 5, 9) || inEllipse(x, y, 39, 24, 5, 9) ? 'e' : null)); // arms
  paint(g, (x, y) => (inRect(x, y, 15, 36, 7, 4) || inRect(x, y, 26, 36, 7, 4) ? 'f' : null)); // legs
  // Molten seams zig-zag across the rock.
  paint(g, (x, y) => (inEllipse(x, y, 24, 27, 13, 11) && Math.abs(((x * 0.7 + y) % 9) - 4.5) < 0.6 ? 'h' : null));
  rect(g, 21, 11, 2, 2, 'h'); // eyes
  rect(g, 26, 11, 2, 2, 'h');
  core(g, 23, 25);
  return decorate(g, 903, [['B', 5, 'd'], ['F', 3, 'h'], ['-', 3, 'e']]);
}

/** Mothership: a vast alien saucer hovering over the plain, its reactor the core. */
export function mothership() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 41 ? 'c' : null));
  paint(g, (x, y) => (inEllipse(x, y, 24, 13, 9, 6) && y <= 15 ? 'f' : null)); // dome
  paint(g, (x, y) => (inEllipse(x, y, 24, 19, 22, 5) ? 'd' : null)); // hull
  paint(g, (x, y) => (inEllipse(x, y, 24, 22, 14, 3) ? 'e' : null)); // underside
  for (let k = 0; k < 7; k++) rect(g, 7 + k * 5.5, 18, 2, 1, 'h'); // running lights
  // Three tractor-beam columns under the hull.
  [12, 24, 36].forEach((bx) => paint(g, (x, y) => (y > 25 && y < 39 && Math.abs(x - bx) <= (y - 25) * 0.18 + 0.6 ? 'g' : null)));
  core(g, 23, 20);
  return decorate(g, 904, [['B', 3, 'd'], ['|', 6, 'g'], ['F', 2, 'e']]);
}
