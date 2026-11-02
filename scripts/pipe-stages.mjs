// Pipe test, last gate (docs/plans/2026-11-02-size-fullscreen-pipes): an L pipe on each stage's floor
// hole, then the autoplay bot's time to the first fruit, with and without the pipe, on the same seeds.
// Gate: the median with the pipe is at most 1.5x the median without. Measurement only, not the game.
// Usage: node scripts/pipe-stages.mjs [from=10] [to=34] [seeds=30] [W] [UP] [RUN]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';
import { carvePipe, pipeStage, PIPE } from '../src/sim/pipes.js';

const [from = 10, to = 34, seeds = 30, W = PIPE.W, UP = PIPE.UP, RUN = PIPE.RUN] = process.argv.slice(2).map(Number);
const SHAPE = { W, UP, RUN }; // the game's PIPE unless given (tuning)
const CAP = 180; // sim seconds before a run counts as "no fruit"

/** The stage's lines with the game's pipe (src/sim/pipes.js) over its floor hole, or null. */
function withPipe(level) {
  const hole = level.holes.find((h) => h.side === 'bottom');
  return hole ? carvePipe(level.lines, level.box, hole, SHAPE)?.lines ?? null : null;
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
console.log(`pipe W=${W} UP=${UP} RUN=${RUN}`);
console.log(`stage  plain(med s, no-fruit)  pipe(med s, no-fruit)  ratio   [${seeds} paired seeds]`);
for (let stage = from; stage <= to; stage++) {
  if (!pipeStage(stage - 1)) { console.log(`${String(stage).padStart(5)}  (no pipe on this stage: big boss)`); continue; }
  const level = getLevel(stage - 1, { pipe: false }); // the plain stage; withPipe() adds the pipe
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
