import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { ICONS, iconArt, splitIcons } from '../src/icons.js';
import { ACHIEVEMENTS } from '../src/achievements.js';
import { FRUITS } from '../src/fruits.js';

const file = (path) => new URL(`../public/art/${path}`, import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Colour emoji draw differently on every phone (or as tofu boxes); the UI swaps them for
// the matching clay icon. Plain glyphs styled by CSS (★ ☆ ♥ ✓ ×) stay text on purpose.
const COLOUR_EMOJI = /\p{Extended_Pictographic}/u;
const GLYPHS = new Set(['★', '☆', '♥', '✓', '↕', '▶']);

describe('icon set', () => {
  it('every icon ships as a small WebP in public/art/ui', () => {
    for (const path of new Set(Object.values(ICONS))) {
      if (!path.startsWith('ui/')) continue;
      expect(path, path).toMatch(/^ui\/[a-z_]+\.webp$/);
      const { size } = statSync(file(path));
      expect(size, path).toBeGreaterThan(500);
      expect(size, path).toBeLessThan(24 * 1024);
      expect(readFileSync(file(path)).subarray(8, 12).toString(), path).toBe('WEBP');
    }
  });

  it('fruit emoji reuse the fruit pictures', () => {
    for (const f of FRUITS) expect(iconArt(f.emoji)).toBe(`fruit/${f.id}.png`);
  });

  it('every achievement badge has an icon', () => {
    for (const a of ACHIEVEMENTS) expect(iconArt(a.icon), a.id).toBeTruthy();
  });

  it('every colour emoji the UI prints has an icon', () => {
    const sources = ['index.html', 'src/ui.js', 'src/main.js', 'src/director.js'].map(read).join('\n');
    const missing = [...new Set(sources.match(new RegExp(COLOUR_EMOJI, 'gu')) ?? [])]
      .filter((e) => !GLYPHS.has(e) && !iconArt(e));
    expect(missing).toEqual([]);
  });

  it('splitIcons cuts text into strings and { emoji, art } parts', () => {
    expect(splitIcons('🪙 1,200 골드 · ⭐ 3')).toEqual([
      { emoji: '🪙', art: 'ui/coin.webp' }, ' 1,200 골드 · ', { emoji: '⭐', art: iconArt('⭐') }, ' 3',
    ]);
    expect(splitIcons('plain ★★☆ ♥♥')).toEqual(['plain ★★☆ ♥♥']);
    expect(splitIcons('')).toEqual([]);
  });

  it('splitIcons keeps variation selectors with their emoji', () => {
    expect(splitIcons('⚠️ BOSS')).toEqual([{ emoji: '⚠️', art: iconArt('⚠') }, ' BOSS']);
  });

  it('unknown emoji stay as text', () => {
    expect(splitIcons('🦄 hi')).toEqual(['🦄 hi']);
  });

  it('the credits name Higgsfield for the icons', () => {
    expect(read('CREDITS.md')).toMatch(/Higgsfield/);
  });
});
