import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { WONDERS, LEVELS } from '../src/sim/maps.js';
import { cleanCredit } from '../src/credits.js';

describe('경이의 세계 murals', () => {
  it('has 12 maps: 4 space, then 4 sea, then 4 nature', () => {
    expect(WONDERS).toHaveLength(12);
    expect(WONDERS.map((m) => m.theme)).toEqual([...Array(4).fill('space'), ...Array(4).fill('sea'), ...Array(4).fill('nature')]);
  });

  it('ids are unique and do not clash with the landmark list', () => {
    const ids = WONDERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const landmarkIds = new Set(LEVELS.map((m) => m.id));
    for (const id of ids) expect(landmarkIds.has(id), id).toBe(false);
  });

  it('entries have the landmark shape plus a theme', () => {
    for (const m of WONDERS) {
      expect(Object.keys(m).sort()).toEqual([...Object.keys(LEVELS[0]), 'theme'].sort());
      expect(m.subtitle).toMatch(/·/);
      expect(m.palette).toHaveLength(8);
      for (const hex of m.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.build().every((line) => line.length === 48)).toBe(true);
    }
  });

  it('every map has a photo with a valid credit', () => {
    const credits = JSON.parse(readFileSync(new URL('../public/landmarks/credits.json', import.meta.url), 'utf8'));
    for (const m of WONDERS) {
      expect(existsSync(new URL(`../public/landmarks/${m.id}.jpg`, import.meta.url)), m.id).toBe(true);
      expect(cleanCredit(credits[m.id]), m.id).not.toBeNull();
    }
  });
});
