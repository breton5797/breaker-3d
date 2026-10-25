import { describe, it, expect } from 'vitest';
import { COLS, ROWS, CELL } from '../src/sim/constants.js';
import { parseLevel, getLevel, stageParams, LEVELS, levelName } from '../src/sim/levels.js';
import { tint } from '../src/sim/maps.js';

const idx = (c, r) => r * COLS + c;

/** Entrance geometry of a built stage: hole span, guard cells under it. */
function entrance(i) {
  const lvl = getLevel(i);
  const g = parseLevel(lvl.lines, { brickHp: lvl.params.brickHp });
  const floor = g.floorRow;
  const hole = [];
  for (let c = 0; c < COLS; c++) if (g.cells[idx(c, floor)] !== CELL.STEEL) hole.push(c);
  const guard = [];
  for (let r = 0; r < floor; r++) {
    for (let c = 0; c < COLS; c++) if (g.cells[idx(c, r)] === CELL.STEEL) guard.push({ c, r });
  }
  return { lvl, g, floor, hole, guard };
}

/** Breakable cells reachable from the entrance without passing through steel. */
function reachableShare(g, floor, hole) {
  const seen = new Uint8Array(g.cells.length);
  const stack = hole.map((c) => idx(c, floor));
  stack.forEach((k) => { seen[k] = 1; });
  let reached = 0;
  while (stack.length) {
    const k = stack.pop();
    if (g.cells[k] !== CELL.EMPTY && g.cells[k] !== CELL.STEEL) reached++;
    const c = k % COLS;
    const r = Math.floor(k / COLS);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= COLS || nr <= floor || nr >= ROWS) continue;
      const nk = idx(nc, nr);
      if (seen[nk] || g.cells[nk] === CELL.STEEL) continue;
      seen[nk] = 1;
      stack.push(nk);
    }
  }
  return reached / g.total;
}

describe('landmark maps', () => {
  it('offer at least 24 distinct landmarks with a place and era', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(LEVELS.map((m) => m.name)).size).toBe(LEVELS.length);
    for (const m of LEVELS) {
      expect(m.subtitle).toMatch(/·/);
      expect(m.palette).toHaveLength(8);
      for (const hex of m.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('every stage is a landmark: first pass in order, then sunset and night revisits', () => {
    const L = LEVELS.length;
    for (let i = 0; i < L; i++) expect(getLevel(i).name).toBe(LEVELS[i].name);
    expect(getLevel(L).name).toBe(`${LEVELS[0].name} · 노을`);
    expect(getLevel(2 * L + 3).name).toBe(`${LEVELS[3].name} · 밤`);
    expect(getLevel(3 * L + 5).name).toBe(LEVELS[5].name);
    for (const i of [0, L, 2 * L, 7 * L + 11]) expect(levelName(i)).toBe(getLevel(i).name);
  });

  it('every mural fits the field with its gutter, so the lobby is never cut off', () => {
    for (const m of LEVELS) {
      const lines = m.build();
      expect(6 + 2 * lines.length).toBeLessThanOrEqual(ROWS - 14);
      for (const l of lines) expect(l.length).toBe(COLS / 2);
    }
  });

  it('revisits recolour the palette but keep valid colours', () => {
    const L = LEVELS.length;
    const day = getLevel(0).palette;
    const dusk = getLevel(L).palette;
    const night = getLevel(2 * L).palette;
    expect(dusk).not.toEqual(day);
    expect(night).not.toEqual(day);
    for (const hex of [...dusk, ...night]) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tint('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  for (let i = 0; i < 24; i++) {
    it(`map ${i + 1} is a solid, fully reachable landmark`, () => {
      const { lvl, g, floor, hole } = entrance(i);
      expect(lvl.lines.length).toBeLessThanOrEqual(ROWS - 14);
      for (const l of lvl.lines) expect(l.length).toBe(COLS);
      expect(g.total).toBeGreaterThan(1000);
      let steel = 0;
      for (let k = 0; k < g.cells.length; k++) if (g.cells[k] === CELL.STEEL && Math.floor(k / COLS) > floor) steel++;
      expect(steel / (g.total + steel)).toBeLessThan(0.15);
      // No steel may seal bricks away from the entrance.
      expect(reachableShare(g, floor, hole)).toBeGreaterThan(0.99);
    });
  }
});

describe('entrance difficulty', () => {
  it('the hole narrows one cell at a time from 16 to 2', () => {
    expect(stageParams(0).holeW).toBe(16);
    expect(stageParams(199).holeW).toBe(2);
    let prev = stageParams(0);
    for (let i = 1; i < 400; i++) {
      const p = stageParams(i);
      expect(prev.holeW - p.holeW).toBeGreaterThanOrEqual(0);
      expect(prev.holeW - p.holeW).toBeLessThanOrEqual(1);
      prev = p;
    }
  });

  it('the hole drifts off-centre gradually after the first 10 stages', () => {
    for (let i = 0; i < 10; i++) expect(stageParams(i).holeShift).toBe(0);
    let prev = stageParams(10);
    for (let i = 11; i < 400; i++) {
      const p = stageParams(i);
      expect(p.holeShift).toBeGreaterThanOrEqual(prev.holeShift);
      expect(p.holeShift - prev.holeShift).toBeLessThanOrEqual(0.03);
      prev = p;
    }
    expect(stageParams(199).holeShift).toBeGreaterThanOrEqual(0.7);
    expect(stageParams(1e6).holeShift).toBeLessThanOrEqual(0.8);
  });

  it('a steel guard appears under the hole from stage 61 and grows', () => {
    for (let i = 0; i < 60; i++) expect(stageParams(i).guard).toBe(0);
    expect(stageParams(60).guard).toBe(1);
    let prev = 0;
    for (let i = 60; i < 400; i++) {
      const { guard } = stageParams(i);
      expect(guard).toBeGreaterThanOrEqual(prev);
      prev = guard;
    }
    expect(prev).toBeLessThanOrEqual(4);
  });

  it('stage 1 has a wide, centred, unguarded entrance', () => {
    const { hole, guard } = entrance(0);
    expect(hole).toHaveLength(16);
    expect(Math.abs((hole[0] + hole.at(-1) + 1) / 2 - COLS / 2)).toBeLessThanOrEqual(0.5);
    expect(guard).toHaveLength(0);
  });

  it('built entrances follow the knobs: width, side offset and a guard that never covers the hole', () => {
    for (const i of [10, 11, 40, 41, 60, 99, 140, 181, 198, 199, 350]) {
      const { lvl, hole, guard, floor, g } = entrance(i);
      const p = lvl.params;
      expect(hole).toHaveLength(p.holeW);
      expect(hole.at(-1) - hole[0]).toBe(p.holeW - 1);
      const centre = (hole[0] + hole.at(-1) + 1) / 2;
      const maxOff = (COLS - p.holeW) / 2 - 6;
      const side = i % 2 === 0 ? 1 : -1;
      expect(Math.abs(centre - (COLS / 2 + side * p.holeShift * maxOff))).toBeLessThanOrEqual(1);
      // Open cavity right above the hole so an entering ball keeps going.
      for (let r = floor + 1; r <= floor + 8; r++) for (const c of hole) expect(g.cells[idx(c, r)]).toBe(CELL.EMPTY);
      // The guard never covers the whole hole: at least one column stays open straight up.
      const want = Math.max(0, Math.min(p.guard, p.holeW - 1));
      expect(guard).toHaveLength(want);
      for (const { c, r } of guard) {
        expect(r).toBe(floor - 2);
        expect(c).toBeGreaterThanOrEqual(hole[0]);
        expect(c).toBeLessThanOrEqual(hole.at(-1));
      }
    }
  });

  it('the narrowest late entrances still carry a guard', () => {
    for (const i of [196, 199, 500]) {
      const { lvl, guard } = entrance(i);
      expect(lvl.params.holeW).toBe(2);
      expect(guard).toHaveLength(1);
    }
  });
});
