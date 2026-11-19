// Demo bot benchmark (marketing shorts, 2026-11-18): on the filmable stages, how often does the demo
// bot (src/demo.js) grow a swarm worth filming within one take? Same world setup as src/main.js.
// Measurement only. Usage: node scripts/marketing/demo-bench.mjs [seeds=8] [seconds=55] [policy=aimed|sweep]
import { getLevel } from '../../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../../src/sim/world.js';
import { mulberry32 } from '../../src/sim/rng.js';
import { demoTarget, demoAngle, demoServe } from '../../src/demo.js';
import { FILMABLE } from './caption.mjs';

const [seeds = 8, seconds = 55] = process.argv.slice(2, 4).map(Number);
const policy = process.argv[4] ?? 'aimed';
const MIN_PEAK = 500; // daily-short.mjs: a take below this is dull

/** One take of the demo bot: peak balls and whether the stage was cleared. */
export function take(stage, seed, { serve = 'aimed', secs = 55 } = {}) {
  const lvl = getLevel(stage - 1);
  const p = lvl.params;
  const w = createWorld(lvl.lines, {
    box: lvl.box, holes: lvl.holes, pipe: lvl.pipe, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW,
    releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: lvl.boss,
    theme: lvl.theme ?? null, charges: { split: 0, meteor: 0 }, rng: mulberry32(stage * 7919 + seed),
  });
  const t0 = seed * 1.37; // the page clock differs from take to take
  for (let t = 0; t < secs && w.state !== 'clear' && w.state !== 'over'; t += 1 / 60) {
    if (w.state === 'ready') launch(w, serve === 'aimed' ? demoServe(w, t0 + t) : demoAngle(t0 + t));
    setPaddleX(w, demoTarget(w, t0 + t));
    stepWorld(w, 1 / 60);
    w.events = [];
  }
  return { peak: w.peakBalls, cleared: w.state === 'clear' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let good = 0;
  let all = 0;
  for (const stage of FILMABLE) {
    const runs = Array.from({ length: seeds }, (_, s) => take(stage, s, { serve: policy, secs: seconds }));
    const ok = runs.filter((r) => r.peak >= MIN_PEAK).length;
    good += ok;
    all += runs.length;
    const peaks = runs.map((r) => r.peak).sort((a, b) => a - b);
    console.log(`stage ${String(stage).padStart(2)}: ${ok}/${seeds} >= ${MIN_PEAK}, cleared ${runs.filter((r) => r.cleared).length}, median peak ${peaks[peaks.length >> 1]}`);
  }
  console.log(`${policy}: ${good}/${all} takes worth filming (${Math.round((100 * good) / all)}%)`);
}
