import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { PLAY, LAP, LEVELS, WONDERS, landmarkAt } from '../src/sim/maps.js';
import { MAP_BOSSES } from '../src/sim/mapBosses.js';
import { getLevel } from '../src/sim/levels.js';
import { stageSlot } from '../src/sim/sequence.js';

const THEMES = ['number', 'alpha', 'hangul', 'animal'];

describe('놀이 세계 chapter', () => {
  it('has 24 maps: 6 numbers, 6 letters, 6 Hangul, 6 animals, after the wonders', () => {
    expect(PLAY).toHaveLength(24);
    expect(PLAY.map((m) => m.theme)).toEqual(THEMES.flatMap((t) => Array(6).fill(t)));
    expect(LAP).toEqual([...LEVELS, ...WONDERS, ...PLAY]);
  });

  it('ids are unique across the whole lap', () => {
    const ids = LAP.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every mural is 48 wide with an 8-colour palette, and has plenty of bricks', () => {
    for (const m of PLAY) {
      const rows = m.build();
      expect(rows.every((line) => line.length === 48), m.id).toBe(true);
      expect(m.palette, m.id).toHaveLength(8);
      for (const hex of m.palette) expect(hex, m.id).toMatch(/^#[0-9a-f]{6}$/i);
      const bricks = rows.join('').replace(/[.S]/g, '').length;
      expect(bricks, m.id).toBeGreaterThan(250);
    }
  });

  it('glyph maps play on the bare table; animal maps show their own picture behind', () => {
    for (const m of PLAY) {
      if (m.theme === 'animal') {
        expect(m.photo, m.id).toBeUndefined();
        expect(existsSync(new URL(`../public/landmarks/${m.id}.jpg`, import.meta.url)), m.id).toBe(true);
      } else expect(m.photo, m.id).toBeNull();
    }
  });

  it('the chapter opens with its own banner, and every map has a boss (none twice in the chapter)', () => {
    const first = LEVELS.length + WONDERS.length;
    expect(landmarkAt(first).chapterName).toBe('놀이 세계');
    expect(landmarkAt(LEVELS.length).chapterName).toBe('경이의 세계');
    expect(landmarkAt(first + 1).chapterName).toBeNull();
    const kinds = PLAY.map((m) => MAP_BOSSES[m.id]?.kind);
    expect(kinds.every(Boolean)).toBe(true);
    expect(new Set(kinds).size).toBe(PLAY.length);
  });

  it('a full mosaic gets fruit in proportion to its bricks (else balls dig for ages before a fruit)', () => {
    const fruit = (lines) => lines.join('').replace(/[^ACDEIM]/g, '').length; // fruit letters (one cell each)
    const mosaic = getLevel(41); // 숫자 2: about 1.7x the bricks of an average mural
    expect(fruit(mosaic.lines)).toBeGreaterThan(mosaic.params.items * 1.4);
    const landmark = getLevel(1); // an average mural keeps its planned count
    expect(fruit(landmark.lines)).toBeLessThanOrEqual(landmark.params.items * 1.1);
  });

  it('its stages build and play like any other (holes, box, boss)', () => {
    let seen = 0;
    for (let n = 0; n < 200 && seen < 6; n++) {
      const slot = stageSlot(n);
      if (slot.boss) continue;
      const map = landmarkAt(slot.content);
      if (!PLAY.includes(map) && !PLAY.some((p) => p.id === map.id)) continue;
      const lvl = getLevel(n);
      expect(lvl.holes.length, `stage ${n}`).toBeGreaterThan(0);
      expect(lvl.boss?.kind, `stage ${n}`).toBe(MAP_BOSSES[map.id].kind);
      expect(lvl.bricks, `stage ${n}`).toBeGreaterThan(1500);
      seen++;
    }
    expect(seen).toBe(6);
  });
});
