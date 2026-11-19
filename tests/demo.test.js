import { describe, it, expect } from 'vitest';
import { demoTarget, demoAngle, demoStage, demoServe } from '../src/demo.js';
import { predictPath } from '../src/sim/aim.js';
import { PADDLE_MAX_ANGLE } from '../src/sim/constants.js';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

// Demo mode (?demo=<stage>) for gameplay shorts (owner, 2026-11-17: daily short videos, chosen by Jev):
// a bot moves the paddle and serves, so a headless browser can record real play.
function play(stage, seconds) {
  const lvl = getLevel(stage - 1);
  const p = lvl.params;
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, pipe: lvl.pipe, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: lvl.boss, rng: mulberry32(stage) });
  const total = w.grid.remaining;
  for (let t = 0; t < seconds && w.state !== 'clear' && w.state !== 'over'; t += 1 / 60) {
    if (w.state === 'ready') launch(w, demoAngle(t));
    setPaddleX(w, demoTarget(w, t));
    stepWorld(w, 1 / 60);
    w.events = [];
  }
  return { w, broken: 1 - w.grid.remaining / total };
}

describe('demo bot', () => {
  it('plays a filmable stage through in a short: fruit early, thousands of balls, cleared within a minute', () => {
    const { w, broken } = play(12, 60); // 숭례문 (scripts/marketing/demo-scout.mjs: fruit at ~7 s, clear at ~27 s)
    expect(w.collected).toBeGreaterThan(0);
    expect(w.peakBalls).toBeGreaterThan(1000);
    expect(broken).toBe(1);
    expect(w.state).toBe('clear');
  }, 30_000); // a whole simulated minute with thousands of balls: slow CI runners need more than 5 s

  it('moves the paddle at most a human-like step per frame and serves at varied angles', () => {
    const { w } = play(3, 2);
    const x = w.paddle.x;
    expect(Math.abs(demoTarget(w, 2) - x)).toBeLessThanOrEqual(2.2 + 1e-9);
    expect(demoAngle(0)).not.toBeCloseTo(demoAngle(1.3), 3);
  });

  it('serves into the box when the aim guide finds a way in, still varied from serve to serve', () => {
    for (const stage of [3, 8, 20, 21]) {
      const { w } = play(stage, 0);
      const angles = [0, 0.7, 1.9, 3.1].map((t) => demoServe(w, t));
      for (const a of angles) expect(predictPath(w, a).end).toBe('enter');
      expect(new Set(angles.map((a) => a.toFixed(2))).size).toBeGreaterThan(1);
    }
  });

  it('lines the paddle up so a lone falling ball goes back into the box', () => {
    const { w } = play(12, 0);
    const half = w.paddle.w / 2;
    // One ball falling straight down onto x = 30 from just above the paddle; the paddle sits there already.
    const lone = { ...w, balls: { ...w.balls, n: 1, x: Float64Array.of(30), y: Float64Array.of(9), vx: Float64Array.of(0), vy: Float64Array.of(-60) }, drops: [], shells: [], paddle: { ...w.paddle, x: 30 } };
    let px = 30;
    for (let f = 0; f < 30; f++) px = demoTarget({ ...lone, paddle: { ...lone.paddle, x: px } }, 0);
    const off = Math.max(-1, Math.min(1, (30 - px) / half));
    const back = predictPath({ ...lone, paddle: { ...lone.paddle, x: 30 } }, off * PADDLE_MAX_ANGLE);
    expect(back.end).toBe('enter');
  });

  it('falls back to the sweep when no serve angle gets in', () => {
    const { w } = play(3, 0);
    expect(demoServe(w, 1.3, () => ({ end: 'paddle' }))).toBe(demoAngle(1.3));
  });

  it('reads the stage from the URL: ?demo=12 -> stage 12, anything else -> no demo', () => {
    expect(demoStage('?demo=12')).toBe(12);
    expect(demoStage('?demo=1')).toBe(1);
    expect(demoStage('?demo=0')).toBeNull();
    expect(demoStage('?demo=abc')).toBeNull();
    expect(demoStage('?demo=99999999')).toBeNull();
    expect(demoStage('')).toBeNull();
  });
});
