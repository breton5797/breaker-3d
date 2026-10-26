import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { COLS, ROWS, CELL } from '../src/sim/constants.js';
import { parseLevel, getLevel, stageParams, LEVELS, levelName, BOX, SLOTS } from '../src/sim/levels.js';
import { tint, LAP, WONDERS } from '../src/sim/maps.js';
import { isInside } from '../src/sim/box.js';
import { stageSlot } from '../src/sim/sequence.js';

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

  it('after the landmarks comes the "경이의 세계" chapter, each map with its gimmick theme', () => {
    const regular = [];
    for (let i = 0; regular.length < LAP.length; i++) if (!stageSlot(i).boss) regular.push(i);
    const firstWonder = getLevel(regular[LEVELS.length]);
    expect(firstWonder.name).toBe(WONDERS[0].name);
    expect(firstWonder.theme).toBe('space');
    expect(firstWonder.chapterStart).toBe(true);
    expect(getLevel(regular[LEVELS.length + 1]).chapterStart).toBe(false);
    WONDERS.forEach((wnd, k) => {
      const lvl = getLevel(regular[LEVELS.length + k]);
      expect(lvl.name).toBe(wnd.name);
      expect(lvl.theme).toBe(wnd.theme);
      expect(lvl.photo).toBe(wnd.id);
    });
    expect(getLevel(0).theme).toBeNull(); // landmarks have no gimmick
  });

  it('wonders come back unchanged on later laps (no "토성 · 노을")', () => {
    const regular = [];
    for (let i = 0; regular.length < LAP.length * 2; i++) if (!stageSlot(i).boss) regular.push(i);
    expect(getLevel(regular[LAP.length]).name).toBe(`${LEVELS[0].name} · 노을`);
    expect(getLevel(regular[LAP.length + LEVELS.length]).name).toBe(WONDERS[0].name);
  });

  it('regular stages show the landmarks in order (bosses take every 10th stage between them)', () => {
    const regular = [];
    for (let i = 0; regular.length < LEVELS.length; i++) if (!stageSlot(i).boss) regular.push(i);
    regular.forEach((stage, k) => expect(getLevel(stage).name).toBe(LEVELS[k].name));
    for (const i of [9, 19, 29]) expect(getLevel(i).name).toMatch(/^BOSS · /);
    for (const i of [0, 9, 24, 30, 200]) expect(levelName(i)).toBe(getLevel(i).name);
    expect(getLevel(0).photoTint).toBe('#ffffff');
    expect(getLevel(9).photo).toBeNull(); // bosses fight on the bare table
  });

  it('revisits recolour the palette but keep valid colours', () => {
    const L = LEVELS.length;
    expect(getLevel(L).palette).not.toEqual(getLevel(0).palette);
    expect(getLevel(2 * L).palette).not.toEqual(getLevel(0).palette);
    for (const hex of [...getLevel(L).palette, ...getLevel(2 * L).palette]) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tint('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  // Every regular map of a lap (24 landmarks + 12 wonders, with bosses in between) and all four bosses.
  const stages = [...Array(LAP.length + 4).keys()];
  for (const i of stages) {
    it(`stage ${i + 1} sits in a steel box and every brick is reachable through its holes`, () => {
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
    for (const i of [0, 7, 15, 25, 40, 99, 160, 333]) {
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
  it('one-ball holes: 4 up to stage 10, 3 up to 20, 2 up to 30, then a single hole', () => {
    const count = (stage) => stageParams(stage - 1).holeCount;
    for (const s of [1, 10]) expect(count(s)).toBe(4);
    for (const s of [11, 20]) expect(count(s)).toBe(3);
    for (const s of [21, 30]) expect(count(s)).toBe(2);
    for (const s of [31, 100, 1000]) expect(count(s)).toBe(1);
    for (let i = 0; i < 500; i++) expect(stageParams(i).holeSize).toBe(1);
  });

  it('the single hole moves to harder spots as stages rise', () => {
    const odds = (i) => getLevel(i).holes.reduce((sum, h) => sum + SLOTS.find((s) => s.slot === h.slot).odds[1], 0);
    const band = (from, to) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += odds(i);
      return sum / (to - from);
    };
    expect(band(30, 60)).toBeGreaterThan(band(100, 130));
    expect(band(100, 130)).toBeGreaterThan(band(200, 230));
    // By stage 200 only the hardest spots (side walls and the ceiling) are left.
    for (let i = 199; i < 230; i++) for (const h of getLevel(i).holes) expect(['left', 'right', 'top']).toContain(h.side);
  });

  it('built stages have exactly the planned holes, all on different spots', () => {
    for (const i of [0, 29, 30, 75, 120, 150, 199, 640]) {
      const { lvl } = build(i);
      expect(lvl.holes).toHaveLength(lvl.params.holeCount);
      expect(new Set(lvl.holes.map((h) => h.slot)).size).toBe(lvl.holes.length);
      for (const h of lvl.holes) expect(SIDES).toContain(h.side);
    }
  });

  it('the first ten stages always keep one hole in the floor, right above the paddle', () => {
    for (let i = 0; i < 10; i++) expect(getLevel(i).holes.some((h) => h.side === 'bottom')).toBe(true);
  });

  it('across stages the holes appear on every side and at every corner', () => {
    const seen = new Set();
    for (let i = 0; i < 300; i++) for (const h of getLevel(i).holes) seen.add(h.side);
    expect([...seen].sort()).toEqual([...SIDES].sort());
  });
});
