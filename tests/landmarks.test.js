import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { COLS, ROWS, CELL } from '../src/sim/constants.js';
import { parseLevel, getLevel, stageParams, LEVELS, levelName, BOX } from '../src/sim/levels.js';
import { tint } from '../src/sim/maps.js';
import { isInside } from '../src/sim/box.js';

const idx = (c, r) => r * COLS + c;
const build = (i) => {
  const lvl = getLevel(i);
  return { lvl, g: parseLevel(lvl.lines, { brickHp: lvl.params.brickHp, box: lvl.box, holes: lvl.holes }) };
};
const SIDES = ['bottom', 'left', 'right', 'top', 'bl', 'br', 'tl', 'tr'];

/** Share of breakable cells reachable from outside the box without crossing steel. */
function reachableShare(g) {
  const seen = new Uint8Array(g.cells.length);
  const stack = [idx(0, ROWS - 1)];
  seen[stack[0]] = 1;
  let reached = 0;
  while (stack.length) {
    const k = stack.pop();
    if (g.cells[k] !== CELL.EMPTY && g.cells[k] !== CELL.STEEL) reached++;
    const c = k % COLS;
    const r = Math.floor(k / COLS);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const nk = idx(nc, nr);
      if (seen[nk] || g.cells[nk] === CELL.STEEL) continue;
      seen[nk] = 1;
      stack.push(nk);
    }
  }
  return reached / g.total;
}

describe('landmark maps', () => {
  it('offer at least 24 distinct landmarks with a place, era and photo id', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(LEVELS.map((m) => m.name)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((m) => m.id)).size).toBe(LEVELS.length);
    for (const m of LEVELS) {
      expect(m.subtitle).toMatch(/·/);
      expect(m.palette).toHaveLength(8);
      for (const hex of m.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('every landmark has a freely licensed photo with credits', () => {
    const credits = JSON.parse(readFileSync(new URL('../public/landmarks/credits.json', import.meta.url), 'utf8'));
    for (const m of LEVELS) {
      expect(existsSync(new URL(`../public/landmarks/${m.id}.jpg`, import.meta.url))).toBe(true);
      const c = credits[m.id];
      expect(c.artist.length).toBeGreaterThan(0);
      expect(c.license).toMatch(/^(public domain|cc0|cc by(-sa)? [\d.]+( \w+)?)$/i);
      expect(c.source).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it('every stage is a landmark: first pass in order, then sunset and night revisits', () => {
    const L = LEVELS.length;
    for (let i = 0; i < L; i++) expect(getLevel(i).name).toBe(LEVELS[i].name);
    expect(getLevel(L).name).toBe(`${LEVELS[0].name} · 노을`);
    expect(getLevel(2 * L + 3).name).toBe(`${LEVELS[3].name} · 밤`);
    expect(getLevel(3 * L + 5).name).toBe(LEVELS[5].name);
    for (const i of [0, L, 2 * L, 7 * L + 11]) expect(levelName(i)).toBe(getLevel(i).name);
    expect(getLevel(L).photo).toBe(LEVELS[0].id);
    expect(getLevel(0).photoTint).toBe('#ffffff');
    expect(getLevel(L).photoTint).not.toBe('#ffffff');
  });

  it('revisits recolour the palette but keep valid colours', () => {
    const L = LEVELS.length;
    expect(getLevel(L).palette).not.toEqual(getLevel(0).palette);
    expect(getLevel(2 * L).palette).not.toEqual(getLevel(0).palette);
    for (const hex of [...getLevel(L).palette, ...getLevel(2 * L).palette]) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tint('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  for (let i = 0; i < 24; i++) {
    it(`map ${i + 1} sits in a steel box and every brick is reachable through its holes`, () => {
      const { lvl, g } = build(i);
      expect(lvl.lines.length).toBeLessThanOrEqual(ROWS - 14);
      for (const l of lvl.lines) expect(l.length).toBe(COLS);
      expect(g.total).toBeGreaterThan(800);
      expect(reachableShare(g)).toBeGreaterThan(0.99);
    });
  }
});

describe('the box', () => {
  it('has open lanes left, right and above, and steel walls with only the holes open', () => {
    const { lvl, g } = build(0);
    const b = lvl.box;
    expect(b).toEqual(BOX(lvl.lines.length));
    expect(b.left).toBeGreaterThanOrEqual(6);
    expect(COLS - 1 - b.right).toBeGreaterThanOrEqual(6);
    expect(ROWS - 1 - b.top).toBeGreaterThanOrEqual(5);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < b.left; c++) expect(g.cells[idx(c, r)]).toBe(CELL.EMPTY);
    const open = new Set(lvl.holes.flatMap((h) => h.cells.map(([c, r]) => idx(c, r))));
    for (let c = b.left; c <= b.right; c++) {
      for (const r of [b.bottom, b.top]) expect(g.cells[idx(c, r)] === CELL.STEEL || open.has(idx(c, r))).toBe(true);
    }
    for (let r = b.bottom; r <= b.top; r++) {
      for (const c of [b.left, b.right]) expect(g.cells[idx(c, r)] === CELL.STEEL || open.has(idx(c, r))).toBe(true);
    }
  });

  it('every hole is 1-2 cells wide and opens onto a clear pocket inside', () => {
    for (const i of [0, 7, 40, 99, 100, 160, 333]) {
      const { lvl, g } = build(i);
      for (const h of lvl.holes) {
        expect(h.size).toBe(lvl.params.holeSize);
        for (const [c, r] of h.cells) expect(g.cells[idx(c, r)]).toBe(CELL.EMPTY);
        // Step a few cells inward from the hole: nothing but air.
        const [c0, r0] = h.cells[0];
        for (let k = 1; k <= 4; k++) expect(g.cells[idx(c0 + h.inward[0] * k, r0 + h.inward[1] * k)]).toBe(CELL.EMPTY);
      }
    }
  });

  it('a ball counts as inside only within the box walls', () => {
    const { lvl, g } = build(0);
    const b = lvl.box;
    const midY = (b.bottom + b.top) / 2;
    expect(isInside(g, (b.left + b.right) / 2, midY)).toBe(true);
    expect(isInside(g, b.left - 2, midY)).toBe(false);
    expect(isInside(g, b.right + 2, midY)).toBe(false);
    expect(isInside(g, (b.left + b.right) / 2, b.bottom - 1)).toBe(false);
    expect(isInside(g, (b.left + b.right) / 2, b.top + 1)).toBe(false);
  });
});

describe('entrance difficulty', () => {
  it('holes shrink from six two-ball holes to a single one-ball hole, never easier', () => {
    expect(stageParams(0)).toMatchObject({ holeCount: 6, holeSize: 2 });
    expect(stageParams(199)).toMatchObject({ holeCount: 1, holeSize: 1 });
    let prev = stageParams(0);
    for (let i = 1; i < 500; i++) {
      const p = stageParams(i);
      expect(p.holeCount).toBeLessThanOrEqual(prev.holeCount);
      expect(p.holeSize).toBeLessThanOrEqual(prev.holeSize);
      expect(prev.holeCount - p.holeCount).toBeLessThanOrEqual(1);
      prev = p;
    }
  });

  it('built stages have exactly the planned holes, all on different spots', () => {
    for (const i of [0, 29, 30, 75, 120, 150, 199, 640]) {
      const { lvl } = build(i);
      expect(lvl.holes).toHaveLength(lvl.params.holeCount);
      expect(new Set(lvl.holes.map((h) => h.slot)).size).toBe(lvl.holes.length);
      for (const h of lvl.holes) expect(SIDES).toContain(h.side);
    }
  });

  it('early stages always keep one hole in the floor, right above the paddle', () => {
    for (let i = 0; i < 60; i++) expect(getLevel(i).holes.some((h) => h.side === 'bottom')).toBe(true);
  });

  it('across stages the holes appear on every side and at every corner', () => {
    const seen = new Set();
    for (let i = 0; i < 120; i++) for (const h of getLevel(i).holes) seen.add(h.side);
    expect([...seen].sort()).toEqual([...SIDES].sort());
  });
});
