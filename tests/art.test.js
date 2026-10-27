import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { ART, fruitArt, artUrl } from '../src/art.js';
import { FRUITS } from '../src/fruits.js';

const file = (path) => new URL(`../public/art/${path}`, import.meta.url);
const allPaths = [...Object.values(ART), ...FRUITS.map((f) => fruitArt(f.id))];

describe('generated artwork', () => {
  it('every fruit has its own picture id', () => {
    expect(new Set(FRUITS.map((f) => f.id)).size).toBe(FRUITS.length);
    for (const f of FRUITS) expect(f.id).toMatch(/^[a-z]+$/);
  });

  it('every referenced picture ships in public/art and stays small', () => {
    for (const path of allPaths) {
      const { size } = statSync(file(path));
      expect(size, path).toBeGreaterThan(1000);
      expect(size, path).toBeLessThan(160 * 1024);
    }
  });

  it('cut-outs (fruit and icons) are PNGs with an alpha channel', () => {
    for (const path of allPaths.filter((p) => p.endsWith('.png'))) {
      const head = readFileSync(file(path)).subarray(0, 26);
      expect(head.subarray(1, 4).toString(), path).toBe('PNG');
      expect(head[25], `${path} colour type`).toBe(6); // RGBA
    }
  });

  it('urls are relative to the deploy base and carry a version (so the offline cache refreshes redrawn art)', () => {
    const url = artUrl('tex/brick.jpg');
    expect(url).toMatch(/^(\.\/|\/)art\/tex\/brick\.jpg\?v=\d+$/);
    expect(url.startsWith('//')).toBe(false);
  });

  it('the credits name the model and its licence', () => {
    const credits = readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8');
    expect(credits).toMatch(/Z-Image-Turbo/);
    expect(credits).toMatch(/Apache/);
  });
});
