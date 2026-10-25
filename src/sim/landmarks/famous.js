// World-famous places and buildings, drawn as brick murals on the coarse
// 48-wide canvas (see mapkit.js). Letters a-h pick the map's palette (sky stays open),
// 'S' is steel, and B/-/|/F/G are bombs, lasers, fire and gold.
import { canvas, paint, put, rect, inTri, inRect, inEllipse, decorate } from '../mapkit.js';
import { H } from './ancient.js';

/** Mount Fuji: a snow-capped cone above a forest lake, red sun behind. */
export function fuji() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 37, 9, 5, 5) ? 'e' : null));
  paint(g, (x, y) => {
    if (y < 10 || Math.abs(x - 24) > (y - 10) * 1.15 + 3) return null;
    if (y < 18 + 1.5 * Math.sin(x * 1.3)) return 'f';
    return x > 24 + (y - 10) * 0.4 ? 'g' : 'd';
  });
  paint(g, (x, y) => (y >= 32 - 1.5 * Math.abs(Math.sin(x / 2)) ? 'c' : null));
  paint(g, (x, y) => (y >= 37 ? 'h' : null));
  return decorate(g, 31, [['F', 4, 'e'], ['-', 6, 'h'], ['B', 3, 'c']]);
}

/** Statue of Liberty on her island, torch raised over New York harbour. */
export function liberty() {
  const g = canvas(H);
  [[0, 27, 5], [5, 24, 4], [9, 29, 3], [34, 25, 4], [38, 21, 5], [43, 27, 5]].forEach(([x, top, w]) => rect(g, x, top, w, 37 - top, 'h'));
  paint(g, (x, y) => (y >= 37 ? 'g' : null));
  rect(g, 12, 35, 24, 2, 'e');
  rect(g, 17, 28, 14, 7, 'e');
  paint(g, (x, y) => (inTri(x, y, 24, 11, 28, 6) ? 'd' : null));
  rect(g, 22, 11, 5, 6, 'd');
  paint(g, (x, y) => (inEllipse(x, y, 24, 9, 2, 2.2) ? 'd' : null));
  [[21, 6], [22, 5], [24, 5], [26, 5], [27, 6]].forEach(([x, y]) => put(g, x, y, 'f'));
  rect(g, 27, 3, 2, 9, 'd');
  rect(g, 26, 1, 4, 2, 'f');
  rect(g, 19, 13, 3, 5, 'f');
  put(g, 27, 0, 'F');
  put(g, 28, 0, 'F');
  put(g, 28, 1, 'G');
  return decorate(g, 32, [['B', 4, 'd'], ['-', 6, 'g'], ['F', 2, 'h']]);
}

/** Eiffel Tower: an open iron lattice over the Champ de Mars. */
export function eiffel() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 41 ? 'c' : null));
  const hw = (y) => 0.8 + ((y - 1) / 40) ** 1.9 * 17;
  paint(g, (x, y) => {
    if (y < 1 || y > 41) return null;
    const half = hw(y);
    const deck = (y >= 14 && y < 15) || (y >= 26 && y < 27.5);
    if (Math.abs(x - 24) > half + (deck ? 1.5 : 0)) return null;
    if (deck) return 'e';
    if (y > 33 && inEllipse(x, y, 24, 42.5, 9, 9.5)) return null;
    if (y > 6 && Math.abs(x - 24) < half - 1.2 && (Math.floor(x) + Math.floor(y)) % 3 === 0) return null;
    return 'd';
  });
  rect(g, 23, 0, 2, 2, 'f');
  put(g, 24, 0, 'G');
  return decorate(g, 33, [['-', 4, 'e'], ['B', 4, 'd'], ['F', 2, 'c']]);
}

/** Leaning Tower of Pisa: arcaded galleries tilting over the lawn. */
export function pisa() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 39 ? 'c' : null));
  const cx = (y) => 24 + (39 - y) * 0.13;
  paint(g, (x, y) => {
    const dx = x - cx(y);
    if (y >= 6 && y < 39 && Math.abs(dx) <= 6) {
      const row = Math.floor(y) % 5;
      if (row === 0) return 'e';
      return row >= 2 && row <= 3 && Math.floor(dx + 6) % 2 === 0 ? 'f' : 'd';
    }
    if (y >= 2 && y < 6 && Math.abs(dx) <= 4) return 'e';
    if (y >= 1 && y < 2 && Math.abs(dx) <= 2) return 'g';
    return null;
  });
  return decorate(g, 34, [['B', 4, 'd'], ['|', 5, 'd'], ['G', 1, 'e']]);
}

/** Taj Mahal: the white dome and minarets above the reflecting pool. */
export function tajMahal() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 38 ? 'c' : null));
  rect(g, 20, 38, 8, 6, 'g');
  rect(g, 4, 31, 40, 7, 'e');
  rect(g, 13, 19, 22, 12, 'd');
  paint(g, (x, y) => (inTri(x, y, 24, 20, 24, 3.5) || inRect(x, y, 20.5, 24, 7, 7) ? 'f' : null));
  [15, 32].forEach((x0) => { rect(g, x0, 22, 2, 4, 'f'); rect(g, x0, 27, 2, 3, 'f'); });
  paint(g, (x, y) => ((inEllipse(x, y, 24, 13, 7.5, 7) || inEllipse(x, y, 16, 17, 2.5, 2.5) || inEllipse(x, y, 32, 17, 2.5, 2.5)) && y <= 19 ? 'd' : null));
  rect(g, 18, 17, 12, 2, 'd');
  rect(g, 23, 4, 2, 3, 'h');
  [6, 40].forEach((x0) => {
    paint(g, (x, y) => (inRect(x, y, x0, 12, 2, 19) ? (Math.floor(y) % 4 === 0 ? 'e' : 'd') : inEllipse(x, y, x0 + 1, 11, 1.5, 1.5) ? 'd' : null));
  });
  put(g, 24, 3, 'G');
  return decorate(g, 35, [['B', 4, 'd'], ['-', 4, 'g'], ['F', 2, 'c']]);
}

/** Big Ben over the Houses of Parliament; the clock ring is steel with four gaps. */
export function bigBen() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 40 ? 'g' : null));
  paint(g, (x, y) => (inRect(x, y, 0, 30, 48, 10) ? (Math.floor(x) % 3 === 1 && Math.floor(y) % 3 === 1 ? 'f' : 'e') : null));
  for (let x = 1; x < 48; x += 4) put(g, x, 29, 'e');
  paint(g, (x, y) => (inRect(x, y, 19, 10, 10, 30) ? (y > 21 && Math.floor(x) % 2 === 0 && Math.floor(y) % 3 === 0 ? 'f' : 'd') : null));
  paint(g, (x, y) => {
    if (inEllipse(x, y, 24, 15, 3.6, 3.6)) return 'h';
    const gap = Math.abs(x - 24) < 1 || Math.abs(y - 15) < 1;
    return inEllipse(x, y, 24, 15, 4.6, 4.6) ? (gap ? 'f' : 'S') : null;
  });
  put(g, 23, 15, 'B');
  put(g, 24, 15, 'B');
  put(g, 25, 15, '-');
  put(g, 24, 13, '|');
  rect(g, 20, 7, 8, 3, 'e');
  paint(g, (x, y) => (inTri(x, y, 24, 0, 7, 4) ? 'e' : null));
  put(g, 24, 0, 'G');
  return decorate(g, 36, [['B', 3, 'd'], ['|', 3, 'e'], ['F', 2, 'e']]);
}

/** Sungnyemun: Seoul's great south gate, a two-tier pavilion on a stone base. */
export function sungnyemun() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 40 ? 'c' : null));
  paint(g, (x, y) => {
    if (y < 27 || y >= 40 || Math.abs(x - 24) > 18 + (y - 27) * 0.3) return null;
    if (inEllipse(x, y, 24, 33, 4, 4) || inRect(x, y, 20, 33, 8, 7)) return 'g';
    return (Math.floor(x) + (Math.floor(y) % 2) * 2) % 4 === 0 ? 'h' : 'e';
  });
  const roof = (top, bottom, hw0, grow) => paint(g, (x, y) => {
    if (y < top || y >= bottom) return null;
    const hw = hw0 + (y - top) * grow;
    const tip = y > bottom - 2 && Math.abs(x - 24) <= hw + 2;
    return Math.abs(x - 24) <= hw || tip ? (y < top + 1 ? 'g' : 'f') : null;
  });
  paint(g, (x, y) => (y >= 24 && y < 27 && Math.abs(x - 24) < 15 ? ([10, 15, 20, 27, 32, 37].includes(Math.floor(x)) ? 'd' : 'h') : null));
  roof(19, 24, 15, 1.4);
  paint(g, (x, y) => (y >= 15 && y < 19 && Math.abs(x - 24) < 12 ? ([13, 18, 29, 34].includes(Math.floor(x)) ? 'd' : 'h') : null));
  rect(g, 21, 15, 6, 3, 'g');
  roof(6, 15, 9, 1.3);
  put(g, 24, 6, 'G');
  return decorate(g, 37, [['B', 4, 'd'], ['-', 4, 'f'], ['F', 2, 'c']]);
}

/** N Seoul Tower on Namsan at night (the antenna is steel). */
export function nSeoulTower() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 24, 41, 27, 16) ? (y > 34 ? 'f' : 'c') : null));
  paint(g, (x, y) => (y >= 38 ? (Math.floor(x * 3 + y * 7) % 5 === 0 ? 'e' : 'g') : null));
  rect(g, 19, 26, 10, 3, 'd');
  rect(g, 23, 9, 2, 17, 'd');
  paint(g, (x, y) => (inEllipse(x, y, 24, 10, 5, 2.4) ? (Math.floor(y) === 10 ? 'f' : 'e') : null));
  rect(g, 21, 6, 6, 2, 'd');
  rect(g, 23, 0, 1, 6, 'S');
  rect(g, 24, 0, 1, 6, 'f');
  return decorate(g, 38, [['h', 14, '.'], ['B', 4, 'd'], ['F', 4, 'e'], ['G', 2, 'c']]);
}

/** Sydney Opera House: white sail shells on the harbour. */
export function operaHouse() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 30 && y < 33 ? 'h' : y >= 33 ? 'g' : null));
  rect(g, 4, 28, 40, 5, 'e');
  [[8, 9, 6], [14, 13, 8], [22, 17, 10], [31, 12, 8], [38, 8, 6]].forEach(([cx, h, w]) => {
    paint(g, (x, y) => (y <= 28 && x >= cx && inEllipse(x, y, cx, 28, w, h) ? (Math.floor(x + y) % 3 === 0 ? 'f' : 'd') : null));
  });
  rect(g, 4, 32, 6, 1, 'S');
  rect(g, 38, 32, 6, 1, 'S');
  return decorate(g, 39, [['-', 6, 'g'], ['B', 4, 'd'], ['F', 2, 'h']]);
}

/** Golden Gate Bridge in the fog; the main cable is a dotted steel line. */
export function goldenGate() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 2, 34, 10, 8) || inEllipse(x, y, 46, 34, 10, 8) ? 'c' : null));
  paint(g, (x, y) => (y >= 34 ? 'g' : null));
  [9, 36].forEach((x0) => {
    rect(g, x0, 5, 3, 29, 'd');
    [9, 16, 23].forEach((y) => rect(g, x0, y, 3, 1, 'f'));
  });
  rect(g, 0, 25, 48, 2, 'd');
  rect(g, 0, 27, 48, 1, 'f');
  const cable = (x) => (x < 10 ? 6 + (10 - x) * 1.9 : x > 37 ? 6 + (x - 37) * 1.9 : 24 - (1 - ((x - 23.5) / 13.5) ** 2) * 18);
  paint(g, (x, y) => (Math.abs(y - cable(x)) < 0.6 && y < 25 ? (Math.floor(x) % 3 === 0 ? 'd' : 'S') : null));
  return decorate(g, 40, [['B', 4, 'd'], ['-', 5, 'g'], ['|', 4, 'd'], ['F', 2, 'c']]);
}

/** St Basil's Cathedral: swirling onion domes over Red Square. */
export function stBasil() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 40 ? 'c' : null));
  paint(g, (x, y) => (inRect(x, y, 4, 30, 40, 10) ? (inEllipse(x, y, Math.floor(x / 6) * 6 + 3, 36, 1.5, 2.5) ? 'g' : 'e') : null));
  rect(g, 21, 14, 6, 16, 'e');
  paint(g, (x, y) => (inTri(x, y, 24, 2, 14, 3) ? 'f' : null));
  [[12, 20, 3.5, 'd', 'h'], [36, 20, 3.5, 'g', 'e'], [17, 24, 3, 'h', 'f'], [31, 24, 3, 'd', 'g'], [7, 27, 2.5, 'f', 'd'], [41, 27, 2.5, 'h', 'd']].forEach(([cx, y0, r, c1, c2]) => {
    rect(g, Math.round(cx - r * 0.7), y0, Math.round(r * 1.4), 30 - y0, 'e');
    paint(g, (x, y) => {
      const bulb = inEllipse(x, y, cx, y0 - r, r, r * 1.1) || inTri(x, y, cx, y0 - 3.2 * r, y0 - 1.6 * r, r * 0.7);
      return bulb ? (Math.floor((x - cx) * 1.5 + y) % 2 ? c1 : c2) : null;
    });
    put(g, Math.floor(cx), Math.floor(y0 - 3.2 * r), 'G');
  });
  [8, 16, 30, 38].forEach((x) => rect(g, x, 34, 2, 4, 'S'));
  return decorate(g, 41, [['B', 4, 'd'], ['|', 4, 'e']]);
}

/** Forbidden City: the Hall of Supreme Harmony on marble terraces (steel balustrades). */
export function forbiddenCity() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 38 ? 'h' : null));
  [[6, 34, 36, 4], [9, 31, 30, 3], [12, 28, 24, 3]].forEach(([x, y, w, h]) => {
    rect(g, x, y, w, h, 'e');
    for (let k = x; k < x + w; k += 2) put(g, k, y, 'S');
  });
  paint(g, (x, y) => (inRect(x, y, 13, 18, 22, 10) ? (Math.floor(x) % 3 === 0 ? 'd' : 'f') : null));
  const roof = (top, bottom, hw0, grow) => paint(g, (x, y) => (y >= top && y < bottom && Math.abs(x - 24) <= hw0 + (y - top) * grow ? 'g' : null));
  roof(14, 18, 14, 1.2);
  rect(g, 16, 12, 16, 2, 'd');
  roof(6, 12, 8, 1.3);
  put(g, 15, 6, 'c');
  put(g, 32, 6, 'c');
  return decorate(g, 42, [['B', 4, 'd'], ['-', 4, 'g'], ['G', 2, 'd']]);
}

/** Sagrada Família: towering spires and a construction crane (steel). */
export function sagradaFamilia() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 40 ? 'c' : null));
  rect(g, 4, 28, 40, 12, 'e');
  paint(g, (x, y) => (inEllipse(x, y, 16, 36, 3, 5) || inEllipse(x, y, 24, 35, 4, 6) || inEllipse(x, y, 32, 36, 3, 5) ? 'g' : null));
  const spire = (cx, top, base, hw) => paint(g, (x, y) => {
    if (y < top || y > base) return null;
    const half = hw * Math.sqrt((y - top) / (base - top));
    if (Math.abs(x - cx) > half) return null;
    return Math.floor(y) % 3 === 0 && Math.abs(x - cx) < half - 0.8 ? 'f' : 'd';
  });
  [[19, 8, 28, 2.5], [29, 8, 28, 2.5], [8, 6, 30, 3], [14, 3, 30, 3], [34, 3, 30, 3], [40, 6, 30, 3], [24, 0, 26, 4]].forEach((s) => spire(...s));
  rect(g, 23, 6, 1, 16, 'S');
  rect(g, 45, 4, 1, 24, 'S');
  rect(g, 37, 4, 8, 1, 'S');
  rect(g, 46, 5, 2, 2, 'S');
  return decorate(g, 43, [['B', 4, 'd'], ['|', 4, 'd'], ['F', 3, 'e']]);
}
