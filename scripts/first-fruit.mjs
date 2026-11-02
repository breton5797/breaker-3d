// Baseline for the pipe test (docs/plans/2026-11-02-size-fullscreen-pipes): how long the
// autoplay bot takes to get a ball into the box and to catch the first fruit, per stage.
// Usage: node scripts/first-fruit.mjs [from=1] [to=59] [seeds=5]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

const [from = 1, to = 59, seeds = 5] = process.argv.slice(2).map(Number);
const CAP = 180; // sim seconds before a run counts as "no fruit"
const dt = 1 / 60;

/** One run: seconds to the first entry and the first catch (null if it never happened). */
function run(li, seed) {
  const lvl = getLevel(li);
  const p = lvl.params;
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: lvl.boss, rng: mulberry32(li + 1 + seed * 1000) });
  let t = 0;
  let entry = null;
  while (t < CAP && w.state !== 'clear' && w.state !== 'over') {
    if (w.state === 'ready') launch(w);
    // The same bot as autoplay.mjs: chase the lowest falling ball or fruit, aim a little off-centre.
    let target = w.paddle.x;
    let low = Infinity;
    for (let i = 0; i < w.balls.n; i++) if (w.balls.vy[i] < 0 && w.balls.y[i] < low) { low = w.balls.y[i]; target = w.balls.x[i]; }
    for (const d of w.drops) if (d.y - 7 < low) { low = d.y - 7; target = d.x; }
    const aim = target + Math.sin(t * 1.7) * 4;
    setPaddleX(w, w.paddle.x + Math.max(-2.2, Math.min(2.2, aim - w.paddle.x)));
    stepWorld(w, dt);
    w.events = [];
    t += dt;
    if (entry === null && w.entered) entry = t; // world.js sets it when a ball of the serve gets into the box
    if (w.collected > 0) return { entry, fruit: t };
  }
  return { entry, fruit: null };
}

const median = (xs) => {
  const s = xs.filter((x) => x !== null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const fmt = (x) => (x === null ? '-' : x.toFixed(1));

console.log('stage  entry(med s)  fruit(med s)  no-fruit');
for (let stage = from; stage <= to; stage++) {
  const runs = Array.from({ length: seeds }, (_, s) => run(stage - 1, s));
  const miss = runs.filter((r) => r.fruit === null).length;
  console.log(`${String(stage).padStart(5)}  ${fmt(median(runs.map((r) => r.entry))).padStart(12)}  ${fmt(median(runs.map((r) => r.fruit))).padStart(12)}  ${miss}/${seeds}`);
}
