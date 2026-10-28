import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { BOSS_MODELS, bossArt } from '../src/art.js';

const file = (path) => new URL(`../public/art/${path}`, import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('boss cards', () => {
  it('every boss has a small WebP portrait for its entrance and KO card', () => {
    for (const kind of Object.keys(BOSS_MODELS)) {
      const path = bossArt(kind);
      const { size } = statSync(file(path));
      expect(size, path).toBeGreaterThan(2000);
      expect(size, path).toBeLessThan(48 * 1024);
      expect(readFileSync(file(path)).subarray(8, 12).toString(), path).toBe('WEBP');
    }
  });

  it('the page has the card and the coin shower layer', () => {
    const html = read('index.html');
    for (const id of ['boss-card', 'boss-card-art', 'boss-card-tag', 'boss-card-name', 'boss-card-stamp', 'shower']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });

  it('the entrance waits for the boss to land, and the KO swaps the toast for the card', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/ui\.bossCard\(\{[^}]*mode: 'intro'/);
    expect(main).toMatch(/audio\.roar\(\)/);
    const director = read('src/director.js');
    expect(director).toMatch(/ui\.bossCard\(\{ kind: e\.kind, mode: 'down' \}\)/);
    expect(director).toMatch(/ui\.shower\(\)/);
  });
});
