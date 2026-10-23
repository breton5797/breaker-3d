// Second set of handcrafted maps. Same coarse 48-wide char canvas as maps.js:
// '#'/'a'-'h' bricks, 'H' hard brick, 'S' steel, 'B' bomb, '-'/'|' lasers,
// 'F' fire, 'G' gold, '2'/'3'/'5' become fruit; 'E' (x30), 'I' (x50) and
// 'M' (x100) are fruit placed by hand. The bottom line becomes the steel floor
// with the entrance hole, so each map leaves open space just above it.
import { mulberry32 } from './rng.js';
import { COLS, canvas, put, rect, stamp, channel, sprinkle, toLines } from './mapkit.js';

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

/** Rocket on the launch pad: fire exhaust ignites balls, a jackpot porthole up top. */
export function rocket() {
  const g = canvas(46);
  for (let k = 0; k < 8; k++) {
    const w = 2 + Math.floor((k * 10) / 7);
    rect(g, 24 - Math.floor(w / 2), k, w, 1, 'b'); // red nose cone
  }
  rect(g, 18, 8, 12, 26, 'a'); // white body
  rect(g, 18, 17, 12, 2, 'b');
  rect(g, 18, 27, 12, 2, 'b');
  for (let y = 9; y < 18; y++) {
    for (let x = 19; x < 29; x++) {
      const d = dist(x, y, 23.5, 13);
      if (d >= 2.2 && d < 3.4) put(g, x, y, 'S'); // porthole rim
      else if (d < 2.2) put(g, x, y, 'C');
    }
  }
  put(g, 23, 13, 'I');
  put(g, 24, 13, 'I');
  rect(g, 23, 16, 2, 1, 'a'); // gap in the rim so balls can reach the jackpot
  for (let k = 0; k < 11; k++) {
    rect(g, 17 - k, 24 + k, k + 1, 1, 'c'); // left fin
    rect(g, 30, 24 + k, k + 1, 1, 'c'); // right fin
  }
  rect(g, 20, 34, 8, 2, 'H'); // engine nozzle
  [[21, 6], [23, 2]].forEach(([x, w], k) => rect(g, x, 36 + k, w, 1, 'F'));
  // Launch-tower gantries on both sides: brick columns braced with steel girders.
  for (const x of [3, 39]) {
    rect(g, x, 4, 6, 34, 'd');
    for (let y = 7; y < 38; y += 6) rect(g, x, y, 6, 1, 'S');
  }
  sprinkle(g, mulberry32(77), 10, 'h', (c) => c === '.'); // stars (plain bricks, not gold)
  return toLines(g);
}

const INVADER = [
  '..#.....#..',
  '...#...#...',
  '..#######..',
  '.##o###o##.',
  '###########',
  '#.#######.#',
  '#.#.....#.#',
  '...##.##...',
];
/** Rows of space invaders with bomb eyes, and classic shield bunkers below. */
export function invaders() {
  const g = canvas(46);
  ['e', 'f', 'g'].forEach((color, row) => {
    for (let k = 0; k < 4; k++) stamp(g, INVADER, 1 + k * 12, 3 + row * 11, 1, { '#': color, o: 'B' });
  });
  for (let k = 0; k < 4; k++) {
    const x = 3 + k * 12;
    rect(g, x, 37, 7, 3, 'S');
    rect(g, x + 2, 39, 3, 1, '.'); // bunker arch
  }
  rect(g, 0, 0, COLS, 2, 'h'); // mothership lane
  put(g, 24, 0, 'M');
  return toLines(g);
}

/** A steel diamond vault packed with jackpot fruit; get in from above via the side shaft. */
export function vault() {
  const g = canvas(46, '#');
  for (let y = 4; y < 38; y++) {
    for (let x = 0; x < COLS; x++) {
      const d = Math.abs(x - 23.5) + Math.abs(y - 21);
      if (d >= 12 && d < 13.5) put(g, x, y, 'S');
      else if (d < 12) put(g, x, y, 'a');
    }
  }
  rect(g, 22, 7, 4, 3, '.'); // the only door, on top
  [[23, 18, 'M'], [21, 21, 'I'], [26, 21, 'I'], [23, 24, 'E'], [19, 19, 'E'], [28, 23, 'E']].forEach(([x, y, c]) => put(g, x, y, c));
  channel(g, 3, 3);
  channel(g, 42, 3);
  return toLines(g);
}

/** Hourglass: the neck is the only way up, and it is packed with bombs. */
export function hourglass() {
  const g = canvas(46, 'S');
  for (let y = 0; y < 42; y++) {
    const half = y < 21 ? 22 - y : y - 19; // narrows to the neck at y=21
    rect(g, 24 - Math.max(2, half), y, Math.max(2, half) * 2, 1, y < 21 ? 'c' : 'd');
  }
  rect(g, 22, 19, 4, 5, 'B');
  [[24, 6], [24, 13], [24, 30], [24, 36]].forEach(([x, y]) => put(g, x, y, '-'));
  rect(g, 0, 42, COLS, 4, '.'); // landing below the glass
  rect(g, 4, 41, 40, 1, '#');
  // A few fruit low in the glass so digging upward pays off early.
  [[10, 39, 'D'], [24, 37, 'E'], [36, 39, 'D'], [17, 33, 'C'], [30, 33, 'C']].forEach(([x, y, c]) => put(g, x, y, c));
  return toLines(g);
}

/** Zig-zag shelves: balls have to snake up through every floor. */
export function zigzag() {
  const g = canvas(46, '#');
  for (let k = 0; k < 6; k++) {
    const y = 6 + k * 6;
    const left = k % 2 === 0;
    rect(g, left ? 0 : 8, y, COLS - 8, 1, 'S');
    rect(g, 0, y + 1, COLS, 1, '.'); // air lane under each shelf
    put(g, left ? 44 : 3, y - 2, '-');
    put(g, 24, y + 3, '-'); // a second laser mid-floor
    put(g, left ? 12 : 35, y + 2, 'B');
    put(g, left ? 30 : 17, y + 4, 'B');
  }
  rect(g, 0, 41, COLS, 5, '.');
  rect(g, 0, 41, COLS, 1, '#');
  return toLines(g);
}

/** Honeycomb of tough-walled cells, each with a soft door and a fruit inside. */
export function honeycomb() {
  const g = canvas(46, '#');
  const rng = mulberry32(31);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      const x = col * 8 + (row % 2) * 4 - 2;
      const y = row * 8 + 1;
      // Walls are hard bricks, not steel, so no cell can ever be sealed off.
      rect(g, x, y, 8, 1, 'H');
      rect(g, x, y + 7, 8, 1, 'H');
      rect(g, x, y, 1, 8, 'H');
      rect(g, x + 7, y, 1, 8, 'H');
      const side = Math.floor(rng() * 4);
      if (side === 0) rect(g, x + 3, y, 2, 1, '#');
      if (side === 1) rect(g, x + 3, y + 7, 2, 1, '#');
      if (side === 2) rect(g, x, y + 3, 1, 2, '#');
      if (side === 3) rect(g, x + 7, y + 3, 1, 2, '#');
      put(g, x + 3 + Math.floor(rng() * 2), y + 3 + Math.floor(rng() * 2), rng() < 0.2 ? 'I' : rng() < 0.5 ? 'E' : 'D');
    }
  }
  rect(g, 0, 41, COLS, 5, '.');
  return toLines(g);
}

/** A frosted donut with laser sprinkles and a fruit stash in the hole. */
export function donut() {
  const g = canvas(46);
  const rng = mulberry32(12);
  const colors = 'abcdefgh';
  for (let y = 0; y < 42; y++) {
    for (let x = 0; x < COLS; x++) {
      const d = dist(x, y, 23.5, 20);
      if (d < 19 && d >= 7.5) put(g, x, y, d > 17.5 || d < 9 ? 'H' : d < 15 ? colors[Math.floor(rng() * 8)] : 'a');
    }
  }
  sprinkle(g, rng, 14, '-', (c) => c >= 'b' && c <= 'h');
  sprinkle(g, rng, 6, '|', (c) => c >= 'b' && c <= 'h');
  [[22, 18, 'I'], [25, 19, 'E'], [23, 21, 'D'], [21, 21, 'E']].forEach(([x, y, c]) => put(g, x, y, c));
  return toLines(g);
}

const CAT = [
  '##..........##',
  '###........###',
  '####......####',
  '##############',
  '##############',
  '##ff######ff##',
  '##ff######ff##',
  '##############',
  '------#B#-----',
  '######www#####',
  '.############.',
  '..##########..',
];
/** Cat face: fire eyes, a bomb nose and laser whiskers. */
export function cat() {
  const g = canvas(46);
  stamp(g, CAT, 3, 2, 3, { '#': 'a', f: 'F', B: 'B', '-': '-', w: 'b' });
  // Two laser whiskers on each cheek; the rest of the whisker row is plain fur.
  for (let y = 0; y < g.length; y++) g[y] = g[y].map((c) => (c === '-' ? 'a' : c));
  [[5, 26], [5, 28], [42, 26], [42, 28]].forEach(([x, y]) => put(g, x, y, '-'));
  return toLines(g);
}

/** Checkerboard: two brick colours, steel studs at every corner, lasers in the middle. */
export function checker() {
  const g = canvas(44);
  for (let by = 0; by < 7; by++) {
    for (let bx = 0; bx < 8; bx++) rect(g, bx * 6, by * 6, 6, 6, (bx + by) % 2 ? 'a' : 'b');
  }
  for (let by = 1; by < 7; by++) for (let bx = 1; bx < 8; bx++) put(g, bx * 6, by * 6, 'S');
  for (let by = 0; by < 7; by += 2) put(g, 3 + (by % 4) * 6, by * 6 + 3, '-');
  for (let bx = 1; bx < 8; bx += 3) put(g, bx * 6 + 3, 21, '|');
  rect(g, 0, 39, COLS, 5, '.');
  return toLines(g);
}

/** Staircase waterfall: steel steps down to the right, laser falls on every ledge. */
export function staircase() {
  const g = canvas(46, '#');
  for (let k = 0; k < 7; k++) {
    const x = k * 6;
    const y = 4 + k * 5;
    rect(g, x, y, 12, 1, 'S');
    put(g, x + 4, y - 1, '|');
  }
  rect(g, 0, 41, COLS, 5, '.');
  rect(g, 40, 0, 8, 36, 'c');
  channel(g, 44, 2);
  return toLines(g);
}
