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

/** Himeji Castle: the white heron keep, roof over roof on its stone base. */
export function himeji() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 38 ? 'c' : null));
  paint(g, (x, y) => (y >= 30 && y < 38 && Math.abs(x - 24) <= 17 + (y - 30) * 0.8 ? 'f' : null));
  // [cx, wall top, wall bottom, wall half-width] from the bottom tier up; a roof two rows tall caps
  // each wall and the next tier rises from that roof.
  const tier = (cx, top, bottom, hw) => {
    paint(g, (x, y) => {
      if (y < top || y >= bottom || Math.abs(x - cx) > hw) return null;
      return Math.floor(y) === top + 1 && Math.floor(x - cx + hw) % 3 === 1 ? 'g' : 'd';
    });
    paint(g, (x, y) => (y >= top - 2 && y < top && Math.abs(x - cx) <= hw + 1 + (y - top + 2) * 1.2 ? 'e' : null));
  };
  tier(12, 23, 30, 4);
  tier(12, 18, 21, 3);
  [[28, 26, 30, 12], [28, 21, 24, 10], [28, 16, 19, 8], [28, 12, 14, 6], [28, 7, 10, 4]].forEach((t) => tier(...t));
  paint(g, (x, y) => (inTri(x, y, 28, 2, 5, 5) || inTri(x, y, 28, 17, 19.5, 3) ? 'e' : null));
  paint(g, (x, y) => (inEllipse(x, y, 3, 38, 6, 6) || inEllipse(x, y, 46, 37, 5, 7) ? 'h' : null));
  put(g, 24, 4, 'G');
  put(g, 32, 4, 'G');
  return decorate(g, 34, [['B', 4, 'd'], ['|', 5, 'd'], ['F', 2, 'h']]);
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

/** Geunjeongjeon of Gyeongbokgung: the two-roofed throne hall on its stone terraces, Bugaksan behind. */
export function gyeongbokgung() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 17 + 9 * Math.abs(Math.sin((x - 24) / 16)) + Math.sin(x / 2) ? 'h' : null));
  paint(g, (x, y) => (y >= 37 ? 'c' : null));
  rect(g, 4, 34, 40, 3, 'e');
  rect(g, 8, 31, 32, 3, 'e');
  for (let x = 5; x < 43; x += 4) put(g, x, 33, 'S');
  for (let x = 9; x < 39; x += 4) put(g, x, 30, 'S');
  rect(g, 22, 31, 4, 6, 'c');
  [10, 15, 33, 38].forEach((x) => rect(g, x, 38, 1, 1, 'e'));
  const body = (top, bottom, hw, posts) => paint(g, (x, y) => {
    if (y < top || y >= bottom || Math.abs(x - 24) > hw) return null;
    if (posts.includes(Math.floor(x))) return 'd';
    return y < top + 1 ? 'g' : Math.floor(x) % 2 ? 'd' : 'g';
  });
  // Flared roof: the eaves sweep up at both ends.
  const roof = (top, bottom, hw0, grow) => paint(g, (x, y) => {
    if (y < top || y >= bottom) return null;
    const hw = hw0 + (y - top) * grow;
    const tip = y >= bottom - 1.5 && Math.abs(x - 24) <= hw + 2;
    return Math.abs(x - 24) <= hw || tip ? 'f' : null;
  });
  body(25, 31, 14, [11, 16, 21, 27, 32, 37]);
  roof(20, 25, 12, 1.2);
  body(16, 20, 9, [15, 20, 28, 33]);
  roof(9, 16, 6, 1.3);
  rect(g, 17, 8, 15, 1, 'f');
  put(g, 16, 8, 'G');
  put(g, 32, 8, 'G');
  return decorate(g, 38, [['B', 4, 'd'], ['-', 4, 'f'], ['F', 2, 'h']]);
}

/** Grand Canyon: banded buttes above the Colorado River (steel ledges in the cliffs). */
export function grandCanyon() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 15 + Math.sin(x / 5) + 0.6 * Math.sin(x * 1.3) ? 'h' : null));
  const strata = (x, y, cx) => (Math.floor(y) % 4 === 0 ? 'e' : x > cx ? 'f' : 'd');
  // A butte narrows in steps of three rows towards its flat top.
  const butte = (cx, top, base, hw) => paint(g, (x, y) => {
    if (y < top || y >= base) return null;
    const step = Math.floor((y - top) / 3);
    return Math.abs(x - cx) <= hw * Math.min(1, 0.35 + step * 0.16) ? strata(x, y, cx) : null;
  });
  butte(14, 17, 34, 11);
  butte(32, 13, 34, 9);
  butte(42, 20, 34, 8);
  paint(g, (x, y) => (y >= 12 && x < Math.floor(y / 3) * 0.8 ? strata(x, y, 99) : null));
  paint(g, (x, y) => (y >= 16 && 48 - x < Math.floor(y / 4) * 0.7 ? strata(x, y, 0) : null));
  paint(g, (x, y) => (y >= 31 ? 'c' : null));
  paint(g, (x, y) => (Math.abs(y - (35 + 1.6 * Math.sin(x / 6))) < 1.4 ? 'g' : null));
  [[8, 24], [20, 27], [29, 22], [39, 28]].forEach(([x, y]) => rect(g, x, y, 3, 1, 'S'));
  return decorate(g, 39, [['-', 6, 'g'], ['B', 4, 'd'], ['F', 2, 'e']]);
}

/** Brandenburg Gate: six Doric columns under the Quadriga (steel column cores). */
export function brandenburgGate() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 39 ? 'c' : null));
  [[0, 5], [43, 5]].forEach(([x0, w]) => {
    rect(g, x0, 24, w, 15, 'h');
    rect(g, x0, 22, w, 2, 'e');
    for (let x = x0 + 1; x < x0 + w; x += 2) rect(g, x, 26, 1, 12, 'f');
  });
  rect(g, 6, 36, 36, 3, 'e');
  for (let k = 0; k < 6; k++) {
    const x = 8 + k * 6;
    rect(g, x, 18, 3, 18, 'd');
    rect(g, x + 2, 18, 1, 18, 'f');
    rect(g, x + 1, 20, 1, 14, 'S');
  }
  rect(g, 6, 13, 36, 5, 'e');
  for (let x = 7; x < 42; x += 2) put(g, x, 15, 'f');
  rect(g, 6, 17, 36, 1, 'd');
  rect(g, 13, 9, 22, 4, 'd');
  rect(g, 15, 10, 18, 2, 'f');
  paint(g, (x, y) => {
    const horse = [16.5, 20.5, 27.5, 31.5].some((hx) => inEllipse(x, y, hx, 7, 2, 1.6) || inRect(x, y, hx - 1.5, 7, 1, 2) || inRect(x, y, hx + 0.5, 7, 1, 2))
      || [17.5, 21.5, 26.5, 30.5].some((hx) => inEllipse(x, y, hx, 5, 1, 1.2));
    return horse || inRect(x, y, 22, 4, 4, 5) ? 'g' : null;
  });
  rect(g, 23, 1, 2, 3, 'g');
  put(g, 23, 0, 'G');
  put(g, 24, 0, 'G');
  return decorate(g, 14, [['-', 4, 'e'], ['B', 5, 'd'], ['F', 2, 'h']]);
}

/** Charles Bridge: Gothic arches over the Vltava up to the Old Town Bridge Tower (steel arch rings). */
export function charlesBridge() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 20, 14, 5, 5) || inRect(x, y, 15, 14, 10, 8) ? 'h' : null));
  rect(g, 19, 6, 2, 4, 'h');
  paint(g, (x, y) => (inRect(x, y, 11, 16, 26, 8) ? (Math.floor(x) % 3 === 0 && Math.floor(y) % 3 === 1 ? 'f' : 'c') : null));
  paint(g, (x, y) => (y >= 31 ? (Math.floor(x * 2 + y * 5) % 7 === 0 ? 'h' : 'g') : null));
  rect(g, 0, 22, 38, 3, 'd');
  rect(g, 0, 21, 38, 1, 'c');
  for (let x = 2; x < 37; x += 5) rect(g, x, 18, 1, 3, 'f');
  // Arches between the piers: the opening shows the river, the ring is steel except at its crown.
  for (let x0 = 0; x0 < 36; x0 += 9) {
    paint(g, (x, y) => {
      if (y < 25 || y >= 31 || x < x0 || x >= x0 + 9) return null;
      const d = ((x - (x0 + 4.5)) / 3.5) ** 2 + ((y - 31) / 5.5) ** 2;
      if (d <= 1) return y >= 31 - 1 ? 'g' : '.';
      if (d <= 1.45) return Math.abs(x - (x0 + 4.5)) < 1.2 ? 'd' : 'S';
      return 'd';
    });
  }
  rect(g, 38, 9, 9, 22, 'e');
  paint(g, (x, y) => (inEllipse(x, y, 42.5, 31, 2.5, 6) && y >= 25 ? 'f' : null));
  [12, 17].forEach((y) => { rect(g, 40, y, 1, 2, 'f'); rect(g, 44, y, 1, 2, 'f'); });
  paint(g, (x, y) => (inTri(x, y, 42.5, 0, 9, 5.5) ? 'f' : inTri(x, y, 37.5, 4, 9, 1.2) || inTri(x, y, 47.5, 4, 9, 1.2) ? 'f' : null));
  put(g, 42, 0, 'G');
  return decorate(g, 16, [['B', 5, 'd'], ['|', 4, 'd'], ['G', 2, 'e']]);
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
