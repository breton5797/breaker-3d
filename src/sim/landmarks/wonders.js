// 경이의 세계: space, the deep sea and natural wonders, drawn as brick murals on
// the coarse 48-wide canvas (see mapkit.js). Letters a-h pick the map's palette
// (sky stays open), 'S' is steel, and B/-/|/F/G are bombs, lasers, fire and gold.
import { canvas, paint, put, rect, inTri, inRect, inEllipse, decorate } from '../mapkit.js';
import { H } from './ancient.js';

/** Scatters single gold-brick stars over the open sky (only on air). */
const stars = (g, cells) => cells.forEach(([x, y]) => { if (g[y][x] === '.') put(g, x, y, 'G'); });
const STARS = [[3, 2], [9, 6], [16, 1], [40, 3], [45, 9], [33, 1], [5, 13], [43, 17], [27, 0], [12, 10]];

// ---------- space ----------

/** Saturn: the banded giant inside its tilted rings; the ring passes in front below, behind above. */
export function saturn() {
  const g = canvas(H);
  const cx = 24;
  const cy = 22;
  const tilt = -0.22;
  // Ring coordinates: u along the ring plane, v across it (squashed: we see the rings at a slant).
  const ring = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    return { r: Math.hypot(u, v / 0.3), v };
  };
  // Bright B ring inside, the dark Cassini division (open), then the A ring.
  const ringCh = ({ r }) => (r >= 15 && r < 19.5 ? 'g' : r >= 20.5 && r < 24.5 ? 'h' : null);
  paint(g, (x, y) => { const p = ring(x, y); return p.v < 0 ? ringCh(p) : null; }); // far side of the ring
  paint(g, (x, y) => {
    if (!inEllipse(x, y, cx, cy, 12.5, 11.5)) return null;
    const band = Math.floor((y - cy + 11.5 + 0.8 * Math.sin(x / 2.5)) / 2.6);
    return ['f', 'f', 'd', 'e', 'd', 'f', 'd', 'e', 'c'][band] ?? 'c';
  });
  paint(g, (x, y) => { const p = ring(x, y); return p.v >= 0 ? ringCh(p) : null; }); // near side crosses the planet
  paint(g, (x, y) => (inEllipse(x, y, 5, 5, 2.2, 2.2) ? 'h' : null)); // a moon
  stars(g, STARS);
  return decorate(g, 51, [['B', 5, 'de'], ['-', 6, 'g'], ['|', 3, 'f']]);
}

/** Curiosity: the rover on Mars with its camera mast up and Mount Sharp behind. */
export function curiosity() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 17 + 6 * Math.abs(Math.sin((x - 6) / 18)) + 0.6 * Math.sin(x) && y < 30 ? 'h' : null));
  paint(g, (x, y) => (y >= 29 + 1.2 * Math.sin(x / 4) ? (Math.floor(x * 3 + y * 7) % 11 === 0 ? 'h' : 'c') : null));
  // Rocker-bogie legs, then the wheels.
  paint(g, (x, y) => (Math.abs(y - (26 + Math.abs(x - 24) * 0.25)) < 0.7 && Math.abs(x - 24) < 12 ? 'f' : null));
  [12, 24, 36].forEach((wx) => paint(g, (x, y) => {
    if (!inEllipse(x, y, wx, 31, 3.6, 3.6)) return null;
    return inEllipse(x, y, wx, 31, 1.3, 1.3) ? 'e' : 'g';
  }));
  // Body: a white deck with the boxy instruments and the RTG at the back.
  rect(g, 14, 20, 22, 6, 'd');
  rect(g, 14, 20, 22, 1, 'e');
  rect(g, 16, 22, 5, 2, 'f');
  rect(g, 24, 22, 4, 3, 'e');
  paint(g, (x, y) => (inRect(x, y, 36, 19, 5, 4) ? (Math.floor(x) % 2 ? 'e' : 'f') : null));
  // Robot arm reaching forward.
  paint(g, (x, y) => (Math.abs(y - (21 + (14 - x) * 0.6)) < 0.7 && x > 7 && x < 14 ? 'e' : null));
  rect(g, 5, 24, 3, 3, 'f');
  // Mast and camera head.
  rect(g, 29, 7, 2, 13, 'e');
  for (let y = 9; y < 19; y += 3) put(g, 29, y, 'S');
  rect(g, 25, 4, 10, 4, 'd');
  rect(g, 26, 5, 2, 2, 'f');
  rect(g, 29, 5, 2, 2, 'f');
  rect(g, 32, 5, 2, 1, 'f');
  return decorate(g, 52, [['B', 5, 'c'], ['-', 5, 'h'], ['F', 2, 'd']]);
}

/** Earthrise: the blue Earth, half in shadow, rising over the grey lunar horizon. */
export function earthrise() {
  const g = canvas(H);
  const cx = 24;
  const cy = 15;
  paint(g, (x, y) => {
    if (!inEllipse(x, y, cx, cy, 10, 10)) return null;
    if ((x - cx) * 0.55 + (y - cy) * 0.83 > 3.2) return 'h'; // night side
    const cloud = Math.sin(x * 0.9 + y * 0.35) + Math.sin(y * 1.3 - x * 0.2) > 1.1;
    if (cloud) return 'f';
    return inEllipse(x, y, cx - 4, cy - 2, 3.5, 4) || inEllipse(x, y, cx + 3, cy - 5, 3, 2) ? 'e' : 'd';
  });
  stars(g, STARS);
  paint(g, (x, y) => {
    if (y < 29 + 0.004 * (x - 24) ** 2 + 0.7 * Math.sin(x / 3)) return null;
    const craters = [[8, 33, 3.5, 1.6], [21, 36, 4.5, 1.8], [37, 32, 3, 1.3], [31, 38, 3.5, 1.4], [44, 35, 2.5, 1.2]];
    const crater = craters.find(([ex, ey, rx, ry]) => inEllipse(x, y, ex, ey, rx, ry));
    if (crater) return y < crater[1] ? 'g' : 'c';
    return Math.floor(x + y * 3) % 7 === 0 ? 'g' : 'c';
  });
  return decorate(g, 53, [['B', 5, 'c'], ['-', 5, 'c'], ['|', 3, 'd']]);
}

/** M87*: the first photo of a black hole — a glowing ring around a shadow you can fly through. */
export function blackHole() {
  const g = canvas(H);
  const cx = 24;
  const cy = 19;
  paint(g, (x, y) => {
    const r = Math.hypot(x - cx, (y - cy) * 1.05);
    if (r < 6.5 || r > 15) return null;
    const lower = (y - cy) / r; // -1 at the top, 1 at the bottom: the bottom glows brightest
    if (r > 13) return (Math.floor(x) + Math.floor(y)) % 2 ? 'c' : 'g';
    if (r < 7.6) return 'h';
    const heat = lower + 0.35 * Math.sin(Math.atan2(y - cy, x - cx) * 3);
    return heat > 0.35 ? 'f' : heat > -0.35 ? 'e' : 'd';
  });
  stars(g, [...STARS, [2, 30], [45, 28], [8, 36], [40, 37], [24, 40]]);
  return decorate(g, 54, [['F', 5, 'f'], ['B', 4, 'e'], ['-', 4, 'd'], ['|', 3, 'g']]);
}

// ---------- deep sea ----------

/** Dumbo octopus: an ear-finned octopus hovering in the abyss, webbed arms curled under. */
export function dumbo() {
  const g = canvas(H);
  // Ear fins first so the mantle overlaps their roots.
  paint(g, (x, y) => {
    const fin = (fx, dir) => inEllipse(x, y, fx, 12 - (x - fx) * dir * 0.35, 5.5, 2.4);
    return fin(12, -1) || fin(36, 1) ? 'e' : null;
  });
  paint(g, (x, y) => {
    if (!inEllipse(x, y, 24, 15, 9, 11) || y > 24) return null;
    return y < 12 ? 'd' : y < 18 ? (Math.floor(x + y) % 5 === 0 ? 'c' : 'd') : 'c';
  });
  [[20, 15], [28, 15]].forEach(([ex, ey]) => paint(g, (x, y) => (inEllipse(x, y, ex, ey, 1.7, 2) ? 'f' : null)));
  // Umbrella of webbed arms with a scalloped hem and curled arm tips.
  paint(g, (x, y) => {
    if (y < 23 || y > 33) return null;
    const hw = 9 + (y - 23) * 0.9;
    if (Math.abs(x - 24) > hw) return null;
    const hem = 31 + 1.8 * Math.cos((x - 24) * 0.9);
    if (y > hem) return null;
    return Math.abs(((x - 24) % 4.5 + 4.5) % 4.5 - 2.25) < 0.6 ? 'g' : 'c';
  });
  [10, 16, 21, 27, 32, 38].forEach((ax) => paint(g, (x, y) => (inEllipse(x, y, ax, 33.5, 1.6, 1.4) ? 'h' : null)));
  return decorate(g, 55, [['B', 5, 'c'], ['-', 5, 'g'], ['F', 2, 'd']]);
}

/** Black smoker: a hydrothermal chimney belching black mineral smoke, tube worms at its foot. */
export function blackSmoker() {
  const g = canvas(H);
  // Billowing plume: overlapping puffs that widen and drift as they rise.
  for (let k = 0; k < 9; k++) {
    const py = 22 - k * 2.6;
    const px = 24 + Math.sin(k * 0.9) * 2.5 + k * 0.4;
    const r = 3 + k * 0.9;
    paint(g, (x, y) => (inEllipse(x, y, px, py, r, r * 0.75) ? (Math.sin(x * 0.7 + y * 0.9 + k) > 0.45 ? 'g' : 'f') : null));
  }
  paint(g, (x, y) => (inEllipse(x, y, 13, 24, 2.5, 3.5) ? 'f' : null)); // a smaller vent's wisp
  // Chimneys: crusted spires, banded with sulfide, with a steel core.
  const spire = (cx, top, hw) => paint(g, (x, y) => {
    if (y < top || y > 34) return null;
    const half = hw * (0.45 + 0.55 * ((y - top) / (34 - top)));
    if (Math.abs(x - cx + Math.sin(y / 2) * 0.6) > half) return null;
    return Math.floor(y + Math.abs(x - cx)) % 3 === 0 ? 'e' : 'd';
  });
  spire(24, 22, 6);
  spire(13, 27, 3.5);
  rect(g, 24, 25, 1, 7, 'S');
  // Rocky mound and the red-plumed tube worms.
  paint(g, (x, y) => (y >= 33 + 2.5 * Math.cos((x - 24) / 9) ? 'c' : null));
  [[30, 31], [32, 32], [34, 31], [16, 32], [36, 32], [19, 32]].forEach(([wx, wy]) => {
    rect(g, wx, wy, 1, 3, 'f');
    put(g, wx, wy - 1, 'h');
  });
  return decorate(g, 56, [['B', 5, 'f'], ['F', 4, 'd'], ['-', 4, 'c']]);
}

/** Halitrephes: a firework jellyfish — a glassy bell with golden canals and a burst of tentacles. */
export function jellyfish() {
  const g = canvas(H);
  const cx = 24;
  const rim = 16;
  // Tentacles fan out and droop from the rim.
  for (let k = 0; k < 15; k++) {
    const a = -1.25 + (k / 14) * 2.5;
    const len = 13 + 4 * Math.cos(k * 1.7);
    for (let s = 0; s < len; s += 0.5) {
      const x = cx + Math.sin(a) * (8 + s * 0.9) + Math.sin(s / 2 + k) * 0.6;
      const y = rim + 1 + s * Math.cos(a * 0.8) + (s * s) * 0.012;
      put(g, Math.floor(x), Math.floor(y), s > len - 1.5 ? 'h' : 'g');
    }
  }
  paint(g, (x, y) => {
    if (!inEllipse(x, y, cx, rim, 10, 10) || y > rim + 1) return null;
    if (y > rim) return 'e';
    const ang = Math.atan2(y - rim, x - cx);
    const canal = Math.abs(((ang * 8 / Math.PI) % 1 + 1) % 1 - 0.5) < 0.12;
    if (inEllipse(x, y, cx, rim - 4, 3, 2.5)) return 'h';
    return canal ? 'f' : Math.hypot(x - cx, y - rim) > 8.8 ? 'e' : 'd';
  });
  return decorate(g, 57, [['B', 4, 'd'], ['|', 5, 'g'], ['F', 3, 'f']]);
}

/** Sperm whales: a mother and her calf gliding under sunbeams. */
export function spermWhale() {
  const g = canvas(H);
  // Sunbeams slanting down from the surface.
  paint(g, (x, y) => (y >= 2 && y < 30 && Math.floor(x - y * 0.45) % 9 === 0 ? 'c' : null));
  const whale = (x0, y0, len, depth, flip) => paint(g, (x, y) => {
    const t = (x - x0) / len; // 0 at the snout, 1 at the flukes
    if (t < 0 || t > 1) return null;
    const half = t < 0.4 ? depth : depth * (1 - (t - 0.4) / 0.6 * 0.82); // blunt square head, tapering tail
    const mid = y0 - (t > 0.75 ? (t - 0.75) * len * 0.45 : 0) * flip;
    if (t > 0.9) return inTri(y, x, mid, x0 + len * 0.9, x0 + len, depth * 0.9) ? 'd' : null; // flukes
    if (Math.abs(y - mid) > half) return null;
    if (t < 0.03 && Math.abs(y - mid) > half * 0.7) return null; // round the snout's corners
    if (t > 0.05 && t < 0.35 && Math.abs(y - (mid + half * 0.55)) < 0.5) return 'f'; // jaw line
    if (y < mid - half * 0.4) return Math.floor(x * 1.3 + y * 2) % 7 === 0 ? 'g' : 'e';
    return 'd';
  });
  whale(1, 17, 37, 5.5, 1);
  whale(22, 29, 24, 3.2, 1);
  rect(g, 8, 16, 1, 1, 'f');
  rect(g, 26, 29, 1, 1, 'f');
  paint(g, (x, y) => (inEllipse(x, y, 13, 23.5, 3, 1) || inEllipse(x, y, 29, 32.5, 2, 0.8) ? 'f' : null)); // flippers
  [[40, 9], [42, 6], [41, 3], [20, 9], [21, 6]].forEach(([x, y]) => put(g, x, y, 'h'));
  return decorate(g, 58, [['B', 5, 'd'], ['-', 6, 'e'], ['F', 2, 'c']]);
}

// ---------- natural wonders ----------

/** Lava fountain: Kīlauea throws a molten arch over the black lava field; a cone smokes beyond. */
export function lavaFountain() {
  const g = canvas(H);
  paint(g, (x, y) => (inTri(x, y, 40, 20, 31, 9) ? 'c' : null));
  paint(g, (x, y) => (inEllipse(x, y, 41, 17, 3, 2) || inEllipse(x, y, 44, 14, 2.5, 1.8) ? 'h' : null));
  // The arch: a thick parabola, yellow at its core and red at its skin.
  paint(g, (x, y) => {
    const top = 5 + 0.085 * (x - 22) ** 2;
    const d = y - top;
    if (d < 0 || d > 6 + Math.abs(x - 22) * 0.12 || y > 31) return null;
    return d < 1.5 ? 'd' : d < 3 ? 'e' : d < 4.5 ? 'f' : 'e';
  });
  paint(g, (x, y) => (inEllipse(x, y, 12, 28, 5, 4) ? (inEllipse(x, y, 12, 28, 2.5, 2.5) ? 'f' : 'd') : null)); // the vent
  paint(g, (x, y) => (y >= 29 + Math.sin(x / 3) * 0.8 && y < 32 && x > 4 && x < 40 ? (Math.floor(x) % 3 ? 'd' : 'e') : null));
  paint(g, (x, y) => {
    if (y < 31 + 0.8 * Math.sin(x / 2.5)) return null;
    const crack = Math.abs(Math.sin(x * 0.55 + y * 1.1)) < 0.12;
    return crack ? 'd' : Math.floor(x + y * 2) % 5 === 0 ? 'h' : 'g';
  });
  // Spatter flung off the arch.
  [[22, 2], [30, 3], [14, 4], [35, 8], [8, 9], [39, 13], [26, 1], [5, 15]].forEach(([x, y]) => put(g, x, y, 'F'));
  return decorate(g, 59, [['F', 4, 'def'], ['B', 4, 'g'], ['-', 4, 'h']]);
}

/** Aurora: green curtains of light rippling over snow and spruce. */
export function aurora() {
  const g = canvas(H);
  // Two curtains of vertical rays: green at the hem, violet fringe on top.
  const curtain = (base, amp, phase, len) => paint(g, (x, y) => {
    const hem = base + amp * Math.sin(x / 6 + phase);
    if (y > hem || y < hem - len - 2 * Math.sin(x * 1.3)) return null;
    if (Math.floor(x) % 3 === 2) return null; // gaps between the rays
    if (y < hem - len + 2) return 'e';
    return y > hem - 2 ? 'f' : 'd';
  });
  curtain(12, 4, 0, 9);
  curtain(25, 3.5, 2.2, 8);
  paint(g, (x, y) => (Math.abs(y - (26 + 3.5 * Math.sin(x / 6 + 2.2))) < 0.6 && Math.floor(x) % 3 === 2 ? 'h' : null));
  stars(g, [[2, 2], [8, 1], [30, 2], [45, 4], [38, 1], [18, 1], [44, 15], [3, 18]]);
  // Snowfield and dark spruce on both sides.
  paint(g, (x, y) => (y >= 33 + 0.5 * Math.sin(x / 4) ? 'c' : null));
  [[2, 23], [6, 25], [10, 27], [38, 26], [42, 24], [46, 22], [27, 29]].forEach(([tx, top]) => {
    paint(g, (x, y) => (inTri(x, y, tx, top, 34, 2.8 + (34 - top) * 0.05) ? 'g' : null));
  });
  return decorate(g, 60, [['B', 5, 'd'], ['|', 5, 'd'], ['F', 2, 'c']]);
}

/** Supercell: a rotating mothership storm over the plains, lightning striking the ground. */
export function supercell() {
  const g = canvas(H);
  paint(g, (x, y) => (y >= 2 && y < 6 && Math.abs(x - 24) < 22 - (y - 2) * 1.5 ? 'f' : null)); // anvil
  // Stacked, striated discs of the updraft, widening into the shelf.
  paint(g, (x, y) => {
    if (y < 6 || y > 25) return null;
    const hw = 9 + (y - 6) * 0.85 + 1.5 * Math.sin(y * 0.9);
    if (Math.abs(x - 24) > hw) return null;
    const band = Math.floor(y + 0.08 * (x - 24) ** 2 * 0.25) % 4;
    return band === 0 ? 'f' : band === 1 ? 'e' : 'd';
  });
  paint(g, (x, y) => (inEllipse(x, y, 27, 25.5, 7, 3) ? 'g' : null)); // lowering wall cloud
  // Lightning: a zigzag bolt of laser blocks from the cloud base to the ground.
  const bolt = [[20, 25], [18, 27], [21, 29], [19, 31], [22, 33]];
  for (let k = 0; k < bolt.length - 1; k++) {
    const [x0, y0] = bolt[k];
    const [x1, y1] = bolt[k + 1];
    for (let s = 0; s <= 4; s++) put(g, Math.round(x0 + ((x1 - x0) * s) / 4), Math.round(y0 + ((y1 - y0) * s) / 4), 'h');
  }
  put(g, 18, 27, '|');
  put(g, 19, 31, '|');
  paint(g, (x, y) => (y >= 33 + 0.4 * Math.sin(x / 2) ? (Math.floor(y) === 34 && Math.floor(x) % 4 === 0 ? 'e' : 'c') : null));
  rect(g, 34, 30, 4, 3, 'f'); // the barn
  paint(g, (x, y) => (inTri(x, y, 36, 28.5, 30, 2.5) ? 'g' : null));
  return decorate(g, 61, [['B', 5, 'd'], ['-', 5, 'e'], ['F', 2, 'c']]);
}

/** Iceberg: the small white tip above the waterline and the vast turquoise mass hidden beneath. */
export function iceberg() {
  const g = canvas(H);
  const water = 17;
  paint(g, (x, y) => (inEllipse(x, y, 40, 6, 3, 3) ? 'h' : null)); // pale sun
  // Above water: jagged peaks.
  paint(g, (x, y) => {
    if (y >= water) return null;
    const peak = Math.min(Math.abs(x - 19) * 1.3 + 5, Math.abs(x - 28) * 1.1 + 9, Math.abs(x - 13) * 1.6 + 11);
    if (y < peak || Math.abs(x - 22) > 13) return null;
    return x > 19 + (y - 5) * 0.3 ? 'e' : 'f';
  });
  // Waterline across the whole width.
  paint(g, (x, y) => (Math.abs(y - (water + 0.4 * Math.sin(x))) < 0.7 ? 'c' : null));
  // Below water: a far larger, lumpy mass.
  paint(g, (x, y) => {
    if (y <= water + 0.7 || y > 38) return null;
    const hw = 19 - ((y - 27) / 11) ** 2 * 13 + 1.5 * Math.sin(y * 0.8);
    if (Math.abs(x - 23 - 2 * Math.sin(y / 5)) > hw) return null;
    if (x > 23 + hw * 0.45) return 'g';
    return Math.floor(x * 2 + y * 3) % 9 === 0 ? 'e' : 'd';
  });
  return decorate(g, 62, [['B', 5, 'd'], ['-', 5, 'g'], ['F', 2, 'f']]);
}
