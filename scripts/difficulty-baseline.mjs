// Difficulty baseline (brainstorm 2026-11-24): does "aim into the hole + split x5" clear every stage?
// The demo bot (aimed serves and returns, src/demo.js) plays each stage with three split policies and
// we compare clear rate, clear time, lives lost and peak balls. Measurement only, not the game.
// Usage: node scripts/difficulty-baseline.mjs [seeds=8] [cap=300] [stages=1,11,31,61,101,151,201,301]
// Env: PRESSURE=off (default, pre-curve game) | curve (pressure.js) | <number> (force that unit pressure on every stage)
//      POLICIES=none,x3,x5x2 (subset to run)
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX, useSkill } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';
import { ballInside } from '../src/sim/units.js';
import { demoTarget, demoServe } from '../src/demo.js';
import { pressureParams, basePressure } from '../src/sim/pressure.js';
import { COLS } from '../src/sim/constants.js';

const [seeds = 8, cap = 300] = process.argv.slice(2, 4).map(Number);
const STAGES = (process.argv[4] ?? '1,11,31,61,101,151,201,301').split(',').map(Number);
const ALL_POLICIES = { none: [], x3: [3], x5x2: [5, 5] };
const POLICIES = Object.fromEntries((process.env.POLICIES ?? 'none,x3,x5x2').split(',').map((k) => [k, ALL_POLICIES[k]]));
const MODE = process.env.PRESSURE ?? 'off';
/** Unit pressure factors for stage index n under MODE. */
function pressureFor(n) {
  if (MODE === 'off') return { fire: 1, stun: 1 };
  if (MODE === 'curve') return pressureParams(n);
  const base = basePressure(n);
  if (base <= 0) return { fire: 1, stun: 1 };
  const s = Number(MODE) / base;
  const stun = Math.min(1, Math.sqrt(s));
  return { fire: s / stun, stun };
}

const DODGE_STEP = 45 / 60; // cells per frame: the dash a person makes in a boss's 1 s warning (boss.js RAIN_REACH note)
/** The demo bot never looks at boss warnings (it only sidesteps unit bombs), so a person-like dodge is added here. */
function dodgeBoss(w, x) {
  const a = w.boss?.alive ? w.boss.attack : null;
  if (!a || a.stage !== 'warn') return x;
  const half = w.paddle.w / 2;
  const clear = (px) => (a.kind === 'sweep'
    ? Math.abs(px - a.safe) + half <= a.gap / 2
    : (a.xs ?? [a.x]).every((z) => Math.abs(px - z) > a.w / 2 + half + 0.5));
  if (clear(w.paddle.x)) return x;
  let best = w.paddle.x;
  for (let d = 1; d < 90; d++) {
    const l = w.paddle.x - d; const r = w.paddle.x + d;
    if (r <= COLS - half && clear(r)) { best = r; break; }
    if (l >= half && clear(l)) { best = l; break; }
  }
  return w.paddle.x + Math.max(-DODGE_STEP, Math.min(DODGE_STEP, best - w.paddle.x));
}

/** One run: the bot plays; `splits` multipliers fire 2 s and 5 s after the first ball gets inside. */
function run(stage, seed, splits) {
  const lvl = getLevel(stage - 1);
  const p = lvl.params;
  const w = createWorld(lvl.lines, {
    box: lvl.box, holes: lvl.holes, pipe: lvl.pipe, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW,
    releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: lvl.boss,
    theme: lvl.theme ?? null, pressure: pressureFor(stage - 1), charges: { split: splits.length, meteor: 0 }, rng: mulberry32(stage * 7919 + seed),
  });
  const lives0 = w.lives;
  let entry = null;
  let fired = 0;
  let t = 0;
  for (; t < cap && w.state !== 'clear' && w.state !== 'over'; t += 1 / 60) {
    if (w.state === 'ready') launch(w, demoServe(w, t + seed));
    setPaddleX(w, dodgeBoss(w, demoTarget(w, t + seed)));
    if (entry === null && w.state === 'play' && ballInside(w)) entry = t;
    if (entry !== null && fired < splits.length && t > entry + 2 + fired * 3 && useSkill(w, 'split', splits[fired])) fired++;
    stepWorld(w, 1 / 60);
    w.events = [];
  }
  return { clear: w.state === 'clear', t, over: w.state === 'over', livesLost: lives0 - w.lives + (w.state === 'over' ? 1 : 0), peak: w.peakBalls, entry };
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
console.log(`seeds=${seeds} cap=${cap}s pressure=${MODE}`);
console.log('stage holes hp | policy: clear%  median clear time  avg lives lost  median peak');
for (const stage of STAGES) {
  const p = getLevel(stage - 1).params;
  const cols = Object.entries(POLICIES).map(([name, splits]) => {
    const runs = Array.from({ length: seeds }, (_, s) => run(stage, s, splits));
    const ok = runs.filter((r) => r.clear);
    const clearPct = Math.round((100 * ok.length) / runs.length);
    const tt = ok.length ? `${med(ok.map((r) => r.t)).toFixed(0)}s` : '-';
    const ll = (runs.reduce((a, r) => a + r.livesLost, 0) / runs.length).toFixed(1);
    const overs = runs.filter((r) => r.over).length;
    return `${name} ${String(clearPct).padStart(3)}% ${tt.padStart(5)} lost ${ll} over ${overs}/${runs.length} peak ${med(runs.map((r) => r.peak))}`;
  });
  console.log(`${String(stage).padStart(3)} h${p.holeCount} hp${p.brickHp} | ${cols.join(' | ')}`);
}
