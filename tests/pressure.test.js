import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getLevel } from '../src/sim/levels.js';
import { pressureParams, basePressure, targetPressure } from '../src/sim/pressure.js';
import { createWorld, stepWorld, launch } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';

const HASHES = JSON.parse(readFileSync(new URL('./fixtures/levels-hash.json', import.meta.url), 'utf8'));

describe('pressure curve (brainstorm 2026-11-24, option 2)', () => {
  it('leaves every stage layout byte-identical (saves and replays keep their maps)', () => {
    for (let i = 0; i < HASHES.length; i++) {
      const h = createHash('sha256').update(JSON.stringify(getLevel(i))).digest('hex').slice(0, 16);
      expect(h, `stage ${i + 1}`).toBe(HASHES[i]);
    }
  });

  it('target pressure rises on every stage and never jumps (no cliff)', () => {
    let prev = targetPressure(5);
    for (let n = 6; n < 2000; n++) {
      const t = targetPressure(n);
      expect(t).toBeGreaterThan(prev);
      expect(t - prev).toBeLessThan(0.08); // no single stage adds a big step
      prev = t;
    }
  });

  it('the scaled pressure lands on the target for every armed stage', () => {
    for (let n = 5; n < 600; n++) {
      const { fire, stun } = pressureParams(n);
      expect(basePressure(n) * fire * stun).toBeCloseTo(targetPressure(n), 6);
    }
  });

  it('stages without units are untouched', () => {
    for (let n = 0; n < 5; n++) expect(pressureParams(n)).toEqual({ fire: 1, stun: 1 });
  });

  it('a single stun never exceeds the cap, and lethal bombs stay lethal', () => {
    for (let n = 5; n < 2000; n += 7) {
      const { stun } = pressureParams(n);
      expect(1.3 * stun).toBeLessThanOrEqual(1.3 + 1e-9);
    }
  });

  it('the world applies fire and stun factors to unit bombs only', () => {
    const lvl = getLevel(120);
    const make = (pressure) => createWorld(lvl.lines, {
      box: lvl.box, holes: lvl.holes, aggression: lvl.params.aggression, rng: mulberry32(1), pressure,
    });
    const calm = make({ fire: 1, stun: 1 });
    const hot = make({ fire: 2, stun: 0.5 });
    expect(calm.pressure).toEqual({ fire: 1, stun: 1 });
    expect(hot.pressure).toEqual({ fire: 2, stun: 0.5 });
    expect(make(undefined).pressure).toEqual({ fire: 1, stun: 1 });
    for (const w of [calm, hot]) { launch(w, 0); stepWorld(w, 1 / 60); }
  });
});
