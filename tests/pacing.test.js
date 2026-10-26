import { describe, it, expect } from 'vitest';
import { createPacing, HIT_STOP_SCALE, HIT_STOP_MAX } from '../src/pacing.js';

const run = (p, seconds, dt = 1 / 60) => {
  const scales = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) scales.push(p.tick(dt));
  return scales;
};

describe('pacing', () => {
  it('runs at full speed by default', () => {
    const p = createPacing();
    expect(run(p, 0.5).every((s) => s === 1)).toBe(true);
  });

  it('slow-mo holds its scale for its duration, then recovers', () => {
    const p = createPacing();
    p.slowMo(0.5, 0.2);
    const s = run(p, 0.4);
    expect(s[0]).toBe(0.5);
    expect(s.at(-1)).toBe(1);
  });

  it('a gentler slow-mo does not override a deeper one', () => {
    const p = createPacing();
    p.slowMo(0.4, 0.5);
    p.slowMo(0.8, 0.5);
    expect(p.tick(1 / 60)).toBe(0.4);
  });

  it('hit-stop nearly freezes time, then hands back to slow-mo', () => {
    const p = createPacing();
    p.slowMo(0.5, 1);
    p.hitStop(0.05);
    expect(p.tick(1 / 60)).toBe(HIT_STOP_SCALE);
    run(p, 0.06);
    expect(p.tick(1 / 60)).toBe(0.5);
  });

  it('hit-stops do not stack past a short cap (no long stalls in a chain reaction)', () => {
    const p = createPacing();
    for (let k = 0; k < 20; k++) p.hitStop(0.08);
    const frozen = run(p, 1).filter((s) => s === HIT_STOP_SCALE).length / 60;
    expect(frozen).toBeLessThanOrEqual(HIT_STOP_MAX + 1 / 60);
  });

  it('after a hit-stop there is a short grace so back-to-back hits keep the game moving', () => {
    const p = createPacing();
    p.hitStop(0.06);
    run(p, 0.08);
    p.hitStop(0.06);
    expect(p.tick(1 / 60)).toBe(1);
  });

  it('reset clears everything', () => {
    const p = createPacing();
    p.slowMo(0.3, 99);
    p.hitStop(0.1);
    p.reset();
    expect(p.tick(1 / 60)).toBe(1);
  });
});
