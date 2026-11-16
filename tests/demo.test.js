import { describe, it, expect } from 'vitest';
import { demoTarget, demoAngle, demoStage } from '../src/demo.js';
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
  });

  it('moves the paddle at most a human-like step per frame and serves at varied angles', () => {
    const { w } = play(3, 2);
    const x = w.paddle.x;
    expect(Math.abs(demoTarget(w, 2) - x)).toBeLessThanOrEqual(2.2 + 1e-9);
    expect(demoAngle(0)).not.toBeCloseTo(demoAngle(1.3), 3);
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
