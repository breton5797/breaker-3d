// Pipe test, last gate (docs/plans/2026-11-02-size-fullscreen-pipes): an L pipe on each stage's floor
// hole, then the autoplay bot's time to the first fruit, with and without the pipe, on the same seeds.
// Gate: the median with the pipe is at most 1.5x the median without. Measurement only, not the game.
// Usage: node scripts/pipe-stages.mjs [from=10] [to=34] [seeds=30]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';
import { ROWS } from '../src/sim/constants.js';

const [from = 10, to = 34, seeds = 30] = process.argv.slice(2).map(Number);
const W = 3; // open cells across the pipe
const UP = 14; // rows the pipe climbs before it bends
const RUN = 16; // cells it then runs sideways
const CAP = 180; // sim seconds before a run counts as "no fruit"
const FRUIT = /[ACDEIM]/; // fruit cells (one fine cell each)
const isBrick = (ch) => ch === '#' || (ch >= 'a' && ch <= 'h');

/** The stage's lines with an L pipe over its floor hole; fruit the pipe cuts away move to its far end. */
function withPipe(level) {
  const hole = level.holes.find((h) => h.side === 'bottom');
  if (!hole) return null;
  const [hx, floor] = hole.cells[0];
  const rows = level.lines.map((l) => [...l]);
  const at = (x, y) => rows[ROWS - 1 - y][x];
  const lost = [];
  const put = (x, y, ch) => { if (FRUIT.test(at(x, y))) lost.push(at(x, y)); rows[ROWS - 1 - y][x] = ch; };
  const { left, right } = level.box;
  const dir = hx - left > right - hx ? -1 : 1; // bend toward the roomier side
  const x0 = hx - 1; // shaft columns x0..x0+W-1
  const y0 = floor + 1;
  const top = y0 + UP;
  const side = dir > 0 ? x0 + W : x0 - 1; // the wall the bend opens through
  const far = dir > 0 ? x0 - 1 : x0 + W;
  const endX = side + dir * (RUN - 1);
  if (endX <= left + 1 || endX >= right - 1) return null;
  for (let x = x0; x < x0 + W; x++) put(x, floor, '.'); // the mouth as wide as the pipe (no traps)
  for (let y = y0; y < top; y++) {
    for (let x = x0; x < x0 + W; x++) put(x, y, '.');
    put(far, y, 'S');
    if (y < top - W) put(side, y, 'S');
  }
  for (let k = -1; k <= W + RUN; k++) put(x0 + (dir > 0 ? k : W - 1 - k), top, 'S'); // cap and roof
  for (let k = 0; k < RUN; k++) {
    const x = side + dir * k;
    for (let y = top - W; y < top; y++) put(x, y, '.');
    put(x, top - W - 1, 'S'); // floor of the sideways part
  }
  // The fruit the pipe cut away go to the nearest plain bricks past its far end (the "vault").
  const spots = [];
  for (let y = top - W - 2; y <= top + 2; y++) for (let k = 1; k <= 8; k++) {
    const x = endX + dir * k;
    if (x > left && x < right && isBrick(at(x, y))) spots.push([x, y]);
  }
  lost.forEach((ch, i) => { if (spots[i]) rows[ROWS - 1 - spots[i][1]][spots[i][0]] = ch; });
  return rows.map((r) => r.join(''));
}

/** The autoplay bot (first-fruit.mjs) on these lines: seconds to the first fruit, or null. */
function firstFruit(level, lines, seed) {
  const p = level.params;
  const li = level.index;
  const w = createWorld(lines, { box: level.box, holes: level.holes, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: level.boss, rng: mulberry32(li + 1 + seed * 1000) });
  const dt = 1 / 60;
  for (let t = 0; t < CAP && w.state !== 'clear' && w.state !== 'over'; t += dt) {
    if (w.state === 'ready') launch(w);
    let target = w.paddle.x;
    let low = Infinity;
    for (let i = 0; i < w.balls.n; i++) if (w.balls.vy[i] < 0 && w.balls.y[i] < low) { low = w.balls.y[i]; target = w.balls.x[i]; }
    for (const d of w.drops) if (d.y - 7 < low) { low = d.y - 7; target = d.x; }
    setPaddleX(w, w.paddle.x + Math.max(-2.2, Math.min(2.2, target + Math.sin(t * 1.7) * 4 - w.paddle.x)));
    stepWorld(w, dt);
    w.events = [];
    if (w.collected > 0) return t + dt;
  }
  return null;
}

const median = (xs) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const fmt = (x) => (x === null ? '   -' : x.toFixed(1).padStart(5));
const all = { plain: [], pipe: [] };
console.log(`stage  plain(med s, no-fruit)  pipe(med s, no-fruit)  ratio   [${seeds} paired seeds]`);
for (let stage = from; stage <= to; stage++) {
  const level = getLevel(stage - 1);
  const lines = withPipe(level);
  if (!lines) { console.log(`${String(stage).padStart(5)}  (no floor hole with room for a pipe: skipped)`); continue; }
  const a = Array.from({ length: seeds }, (_, s) => firstFruit(level, level.lines, s));
  const b = Array.from({ length: seeds }, (_, s) => firstFruit(level, lines, s));
  all.plain.push(...a.map((x) => x ?? CAP));
  all.pipe.push(...b.map((x) => x ?? CAP));
  const [ma, mb] = [median(a), median(b)];
  const miss = (xs) => xs.filter((x) => x === null).length;
  console.log(`${String(stage).padStart(5)}  ${fmt(ma)}  ${String(miss(a)).padStart(3)}/${seeds}          ${fmt(mb)}  ${String(miss(b)).padStart(3)}/${seeds}        ${ma && mb ? (mb / ma).toFixed(2) : '-'}`);
}
// Overall: misses count as the cap (180 s), so a pipe that blocks fruit shows up in the median.
const [pa, pb] = [median(all.plain), median(all.pipe)];
console.log(`ALL    median ${pa.toFixed(1)} s -> ${pb.toFixed(1)} s  ratio ${(pb / pa).toFixed(2)}  (gate <= 1.50; no-fruit runs counted as ${CAP} s)`);
