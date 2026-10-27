import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { BOSS_MODELS } from '../src/art.js';
import { fitScale } from '../src/render/bossFit.js';

const file = (path) => new URL(`../public/art/${path}`, import.meta.url);
const KINDS = ['colossus', 'kraken', 'golem', 'mothership'];

describe('boss 3D models', () => {
  it('every boss kind has a model', () => {
    expect(Object.keys(BOSS_MODELS).sort()).toEqual([...KINDS].sort());
  });

  it('each model ships as a binary glTF small enough for a phone', () => {
    for (const kind of KINDS) {
      const path = file(BOSS_MODELS[kind]);
      const { size } = statSync(path);
      expect(size, kind).toBeGreaterThan(20 * 1024);
      expect(size, kind).toBeLessThan(1.5 * 1024 * 1024);
      expect(readFileSync(path).subarray(0, 4).toString(), kind).toBe('glTF');
    }
  });

  it('fitScale makes the wider side of the model span the boss width', () => {
    expect(fitScale({ x: 2, y: 4 }, 10)).toBeCloseTo(5); // 4 * 5 = 20 = 2r
    expect(fitScale({ x: 8, y: 1 }, 9)).toBeCloseTo(18 / 8);
  });

  it('fitScale survives an empty or broken box', () => {
    expect(fitScale({ x: 0, y: 0 }, 9)).toBe(1);
    expect(fitScale({ x: NaN, y: 2 }, 9)).toBe(1);
  });

  it('the credits name Ludo and its licence terms', () => {
    const credits = readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8');
    expect(credits).toMatch(/Ludo/);
    expect(credits).toMatch(/ludo\.ai\/terms-of-service/);
  });
});
