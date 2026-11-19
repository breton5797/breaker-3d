// Finds stages that film well in demo mode (src/demo.js): how soon the bot catches fruit, how many
// balls it reaches and whether it clears, per stage. Picks the daily short's stage.
// Usage: node scripts/marketing/demo-scout.mjs [from=1] [to=40] [seconds=180]
import { getLevel } from '../../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../../src/sim/world.js';
import { mulberry32 } from '../../src/sim/rng.js';
import { demoTarget, demoAngle } from '../../src/demo.js';

/** Plays stage (1-based) for up to `seconds`; returns what a viewer would see. */
export function scout(stage, seconds = 180) {
  const lvl = getLevel(stage - 1);
  const p = lvl.params;
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, pipe: lvl.pipe, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: lvl.boss, rng: mulberry32(stage) });
  const total = w.grid.remaining;
  let t = 0;
  let firstFruit = null;
  let peakAt = 0;
  while (t < seconds && w.state !== 'clear' && w.state !== 'over') {
    if (w.state === 'ready') launch(w, demoAngle(t));
    setPaddleX(w, demoTarget(w, t));
    const before = w.peakBalls;
    stepWorld(w, 1 / 60);
    if (w.peakBalls > before) peakAt = t;
    if (firstFruit === null && w.collected > 0) firstFruit = t;
    w.events = [];
    t += 1 / 60;
  }
  return { stage, name: lvl.name, firstFruit, peak: w.peakBalls, peakAt, broken: 1 - w.grid.remaining / total, state: w.state, t };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [from = 1, to = 40, secs = 180] = process.argv.slice(2).map(Number);
  for (let s = from; s <= to; s++) {
    const r = scout(s, secs);
    console.log(`${String(s).padStart(3)} ${r.name.padEnd(12)} fruit@${r.firstFruit === null ? '  -  ' : r.firstFruit.toFixed(0).padStart(4) + 's'} peak=${String(r.peak).padStart(5)}@${r.peakAt.toFixed(0)}s broken=${(r.broken * 100).toFixed(0)}% ${r.state} ${r.t.toFixed(0)}s`);
  }
}
