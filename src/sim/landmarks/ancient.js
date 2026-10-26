// Ancient civilisations and ruins, drawn as brick murals on the coarse 48-wide
// canvas (see mapkit.js). Letters a-h pick the map's palette (sky stays open),
// 'S' is steel, and B/-/|/F/G are bombs, lasers, fire and gold.
import { canvas, paint, put, rect, toLines, inTri, inRect, inEllipse, decorate } from '../mapkit.js';

export const H = 44; // coarse rows per mural

/** Great Pyramids of Giza: three pyramids under a desert sun. */
export function giza() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 40, 8, 4, 4) ? 'e' : null));
  const pyramid = (cx, top, hw) => paint(g, (x, y) => {
    if (!inTri(x, y, cx, top, 38, hw)) return null;
    if (Math.floor(y) % 3 === 0) return 'g';
    return x < cx ? 'd' : 'f';
  });
  pyramid(37, 15, 13);
  pyramid(44, 28, 7);
  pyramid(19, 6, 19);
  paint(g, (x, y) => (y >= 38 + Math.sin(x / 4) ? 'c' : null));
  put(g, 18, 6, 'G');
  return decorate(g, 11, [['B', 6, 'e'], ['-', 8, 'df'], ['F', 3, 'c']]);
}

/** Stonehenge at sunrise: trilithons against a low sun. */
export function stonehenge() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 24, 25, 6, 6) ? 'e' : null));
  paint(g, (x, y) => (y >= 30 + 2 * Math.sin(x / 6) ? 'h' : null));
  paint(g, (x, y) => (y >= 34 ? 'c' : null));
  [[3, 20], [10, 18], [19, 17], [25, 17], [34, 18], [41, 20]].forEach(([x, top]) => {
    rect(g, x, top, 4, 34 - top, 'd');
    rect(g, x + 3, top, 1, 34 - top, 'f');
  });
  rect(g, 2, 17, 13, 2, 'f');
  rect(g, 18, 14, 12, 3, 'f');
  rect(g, 33, 16, 13, 2, 'f');
  rect(g, 6, 36, 10, 2, 'd');
  return decorate(g, 12, [['B', 4, 'e'], ['|', 4, 'd'], ['F', 3, 'e']]);
}

/** Moai of Rapa Nui: a row of stone heads facing inland. */
export function moai() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 26 && y < 33 ? 'g' : y >= 33 ? 'c' : null));
  const head = (x0, top, hat) => {
    if (hat) rect(g, x0 + 1, top - 2, 5, 2, 'h');
    rect(g, x0, top, 7, 10, 'd');
    rect(g, x0, top + 3, 7, 1, 'e');
    rect(g, x0 + 1, top + 4, 2, 1, 'f');
    rect(g, x0 + 4, top + 4, 2, 1, 'f');
    rect(g, x0 + 3, top + 4, 1, 4, 'e');
    rect(g, x0 + 2, top + 8, 3, 1, 'f');
    rect(g, x0 + 1, top + 10, 5, 2, 'd');
    rect(g, x0, top + 12, 7, 37 - (top + 12), 'd');
    rect(g, x0, top + 13, 1, 6, 'e');
    rect(g, x0 + 6, top + 13, 1, 6, 'e');
  };
  [[3, 14, false], [12, 11, true], [21, 9, false], [30, 11, true], [39, 14, false]].forEach(([x, t, hat]) => head(x, t, hat));
  return decorate(g, 13, [['-', 6, 'g'], ['F', 2, 'h'], ['B', 4, 'd']]);
}

/** Great Sphinx of Giza with a pyramid behind it. */
export function sphinx() {
  const g = canvas(H);
  paint(g, (x, y) => (inTri(x, y, 12, 14, 34, 10) ? (x < 12 ? 'd' : 'f') : null));
  paint(g, (x, y) => (inTri(x, y, 30, 5, 34, 17) ? (x < 30 ? 'd' : 'f') : null));
  paint(g, (x, y) => (y >= 34 + Math.sin(x / 5) ? 'c' : null));
  paint(g, (x, y) => (inEllipse(x, y, 20, 31, 15, 5) && y >= 27 ? 'g' : null));
  rect(g, 6, 31, 30, 5, 'g');
  rect(g, 33, 32, 12, 3, 'g');
  rect(g, 32, 13, 9, 14, 'h');
  paint(g, (x, y) => (inTri(x, y, 36.5, 10, 14, 5) ? 'h' : null));
  for (let y = 14; y < 27; y += 2) rect(g, 32, y, 9, 1, 'e');
  rect(g, 34, 15, 5, 9, 'g');
  rect(g, 35, 17, 1, 1, 'f');
  rect(g, 37, 17, 1, 1, 'f');
  rect(g, 34, 24, 5, 4, 'g');
  [[4, 39], [17, 40], [41, 38], [27, 41]].forEach(([x, y]) => rect(g, x, y, 2, 1, 'S'));
  return decorate(g, 15, [['B', 5, 'd'], ['-', 6, 'h'], ['F', 2, 'c']]);
}

/** Chichen Itza (El Castillo): a stepped pyramid with steel terrace lips. */
export function chichenItza() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 31 + 2 * Math.abs(Math.sin(x / 3)) ? (y >= 38 ? 'h' : 'c') : null));
  for (let k = 0; k < 9; k++) {
    const y0 = 31 - k * 3;
    const hw = Math.round(22 - k * 2.2);
    rect(g, 24 - hw, y0, hw * 2, 3, k % 2 ? 'd' : 'e');
    rect(g, 24 - hw, y0, 3, 1, 'S');
    rect(g, 24 + hw - 3, y0, 3, 1, 'S');
  }
  paint(g, (x, y) => (x >= 21 && x < 27 && y >= 7 && y < 34 ? (Math.floor(y) % 2 ? 'f' : 'g') : null));
  rect(g, 18, 2, 12, 5, 'e');
  rect(g, 22, 4, 4, 3, 'g');
  put(g, 20, 33, 'B');
  put(g, 27, 33, 'B');
  return decorate(g, 17, [['-', 4, 'f'], ['B', 4, 'd'], ['F', 3, 'c']]);
}

/** Angkor Wat at sunrise: five lotus towers mirrored in the moat. */
export function angkorWat() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 37, 14, 4, 4) ? 'e' : null));
  const tower = (x, y, cx, top, base, hw) => {
    const mid = top + (base - top) * 0.55;
    return (y >= top + 3 && inEllipse(x, y, cx, mid, hw, (base - top) * 0.5)) || inTri(x, y, cx, top, top + 4, hw * 0.5);
  };
  const temple = (x, y) => {
    if (tower(x, y, 24, 3, 22, 4.5) || tower(x, y, 14, 9, 24, 3.5) || tower(x, y, 34, 9, 24, 3.5)
      || tower(x, y, 6, 15, 30, 3) || tower(x, y, 42, 15, 30, 3)) return Math.floor(y) % 3 === 0 ? 'e' : 'f';
    if (inRect(x, y, 2, 30, 44, 7) || inRect(x, y, 6, 25, 36, 5)) return 'd';
    if (inRect(x, y, 10, 21, 28, 4)) return 'e';
    return null;
  };
  paint(g, (x, y) => (y < 37 ? temple(x, y) : temple(x, 74 - y) ? 'h' : 'g'));
  for (let x = 4; x < 45; x += 4) rect(g, x, 32, 1, 2, 'S');
  put(g, 24, 3, 'G');
  return decorate(g, 18, [['-', 4, 'g'], ['B', 4, 'd'], ['F', 2, 'e']]);
}

/** Petra's Treasury carved into a rose canyon (steel strata in the cliffs). */
export function petra() {
  const g = canvas(H, 'c');
  paint(g, (x, y) => (y < 6 && Math.abs(x - 24) < 6 - y * 0.6 ? 'a' : (x + y * 0.6) % 7 < 1.2 ? 'h' : null));
  paint(g, (x, y) => (inRect(x, y, 9, 6, 30, 34) ? 'd' : null));
  [11, 16, 21, 26, 31, 36].forEach((x) => { rect(g, x, 25, 2, 15, 'e'); rect(g, x + 2, 25, 1, 15, 'f'); });
  paint(g, (x, y) => (inTri(x, y, 24, 19, 24, 15) ? 'e' : null));
  rect(g, 22, 30, 4, 10, 'g');
  rect(g, 20, 9, 8, 12, 'e');
  paint(g, (x, y) => (inTri(x, y, 24, 5, 9, 4) ? 'e' : null));
  paint(g, (x, y) => (inTri(x, y, 14, 9, 13, 5) || inTri(x, y, 34, 9, 13, 5) ? 'f' : null));
  [11, 15, 32, 36].forEach((x) => rect(g, x, 13, 2, 8, 'e'));
  paint(g, (x, y) => (y >= 40 ? 'b' : null));
  [2, 5, 42, 45].forEach((x, k) => [6, 18, 30].forEach((y0) => rect(g, x, y0 + (k % 2) * 4, 1, 5, 'S')));
  put(g, 24, 5, 'G');
  return decorate(g, 19, [['B', 5, 'c'], ['|', 4, 'e'], ['F', 2, 'g']]);
}

/** Machu Picchu: stone terraces under Huayna Picchu (steel terrace walls). */
export function machuPicchu() {
  const g = canvas(H);
  paint(g, (x, y) => (inEllipse(x, y, 10, 5, 6, 2) || inEllipse(x, y, 30, 8, 7, 2) ? 'b' : null));
  paint(g, (x, y) => (inTri(x, y, 8, 10, 30, 14) ? 'h' : null));
  paint(g, (x, y) => (inTri(x, y, 35, 2, 30, 13) ? (Math.floor(x + y) % 5 === 0 ? 'h' : 'c') : null));
  paint(g, (x, y) => (y >= 20 + Math.abs(x - 24) * 0.25 ? (Math.floor(y) % 3 === 0 ? 'e' : 'g') : null));
  for (let k = 0; k < 6; k++) {
    const y = 24 + k * 3;
    for (let x = (k % 2) * 5; x < 48; x += 10) rect(g, x, y, 4, 1, 'S');
  }
  [[6, 25], [15, 28], [28, 26], [37, 30]].forEach(([x, y]) => {
    rect(g, x, y, 5, 3, 'd');
    paint(g, (px, py) => (inTri(px, py, x + 2.5, y - 2, y, 3) ? 'f' : null));
  });
  return decorate(g, 20, [['B', 4, 'b'], ['-', 5, 'g'], ['G', 2, 'c']]);
}

/** Great Wall winding over the hills; its battlements are steel teeth. */
export function greatWall() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 16 + 6 * Math.sin(x / 7) + 3 * Math.sin(x / 3) ? 'h' : null));
  paint(g, (x, y) => (y >= 24 + 5 * Math.sin(x / 5 + 1) ? 'c' : null));
  const wall = (yc) => {
    paint(g, (x, y) => {
      const c = yc(x);
      if (y >= c - 2 && y < c + 2) return y < c - 1 ? 'e' : 'd';
      if (y >= c - 3 && y < c - 2 && Math.floor(x) % 2 === 0) return 'S';
      return null;
    });
  };
  const upper = (x) => 26 + 7 * Math.sin(x / 8);
  wall(upper);
  wall((x) => 38 + 2 * Math.sin(x / 6 + 2));
  [6, 22, 38].forEach((tx) => {
    const top = Math.round(upper(tx + 0.5)) - 8;
    rect(g, tx - 2, top, 5, 7, 'f');
    rect(g, tx - 1, top + 2, 1, 2, 'g');
    rect(g, tx + 1, top + 2, 1, 2, 'g');
    rect(g, tx - 3, top - 1, 7, 1, 'e');
  });
  return decorate(g, 21, [['B', 4, 'd'], ['|', 4, 'c'], ['F', 2, 'h']]);
}
