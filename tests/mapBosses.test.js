import { describe, it, expect } from 'vitest';
import { getLevel } from '../src/sim/levels.js';
import { LAP, PLAY } from '../src/sim/maps.js';
import { stageSlot } from '../src/sim/sequence.js';
import { MAP_BOSSES, MOVES, ATTACKS } from '../src/sim/mapBosses.js';
import { createWorld, stepWorld, drainEvents, launch } from '../src/sim/world.js';
import { updateBoss, damageBoss, PLATES } from '../src/sim/boss.js';

function rng(seed = 5) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const worldFor = (n) => {
  const level = getLevel(n);
  const w = createWorld(level.lines, { box: level.box, holes: level.holes, boss: level.boss, rng: rng() });
  return { level, w };
};
/** First regular (non-boss) stage indices, in order. */
const regular = (count) => {
  const out = [];
  for (let n = 0; out.length < count; n++) if (!stageSlot(n).boss) out.push(n);
  return out;
};

describe('map bosses: one per map', () => {
  it('every map in the lap has its own boss with a name, a move and an attack', () => {
    for (const m of LAP) {
      const b = MAP_BOSSES[m.id];
      expect(b, m.id).toBeTruthy();
      expect(b.name.length, m.id).toBeGreaterThan(0);
      expect(MOVES, `${m.id} move`).toContain(b.move);
      expect(ATTACKS, `${m.id} attack`).toContain(b.attack);
    }
  });

  it('no two maps share a boss within a chapter (놀이 세계 reuses earlier ones)', () => {
    const first = LAP.length - PLAY.length; // 놀이 세계 closes the lap
    for (const chapter of [LAP.slice(0, first), LAP.slice(first)]) {
      const kinds = chapter.map((m) => MAP_BOSSES[m.id].kind);
      expect(new Set(kinds).size).toBe(chapter.length);
    }
  });

  it('a regular stage carries its map boss, smaller than a 10th-stage boss', () => {
    const level = getLevel(0);
    expect(level.boss.kind).toBe(MAP_BOSSES.giza.kind);
    expect(level.boss.r).toBeLessThan(9);
    expect(level.boss.plates).toBeLessThan(PLATES);
    expect(level.bossName).toBe(`BOSS · ${MAP_BOSSES.giza.name}`);
    expect(getLevel(9).bossName).toBe(getLevel(9).name); // the big boss keeps its stage name
  });

  it('a map boss flies over the mural and stays inside the box with its plates', () => {
    for (const n of regular(36)) {
      const { w } = worldFor(n);
      const { box } = w.grid;
      for (let t = 0; t < 30; t += 1 / 30) {
        updateBoss(w, 1 / 30);
        const reach = w.boss.plateOrbit + w.boss.plateR;
        expect(w.boss.x - reach, `stage ${n + 1}`).toBeGreaterThanOrEqual(box.left + 1 - 1e-6);
        expect(w.boss.x + reach, `stage ${n + 1}`).toBeLessThanOrEqual(box.right + 1e-6);
        expect(w.boss.y + reach, `stage ${n + 1}`).toBeLessThanOrEqual(box.top + 1e-6);
        expect(w.boss.y - reach, `stage ${n + 1}`).toBeGreaterThanOrEqual(box.bottom + 1 - 1e-6);
      }
    }
  });

  it('it roams across the box (not pinned in a corner)', () => {
    const { w } = worldFor(0);
    const xs = [];
    for (let t = 0; t < 20; t += 1 / 30) { updateBoss(w, 1 / 30); xs.push(w.boss.x); }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
  });

  it('the first five stages are gentle: their bosses never attack', () => {
    for (const n of regular(5)) {
      const { w } = worldFor(n);
      w.state = 'play';
      const ev = [];
      for (let t = 0; t < 40; t += 1 / 30) { updateBoss(w, 1 / 30); ev.push(...drainEvents(w)); }
      expect(ev.filter((e) => e.t === 'boss-warn'), `stage ${n + 1}`).toHaveLength(0);
    }
  });

  it('later map bosses attack, but less often than a 10th-stage boss', () => {
    const count = (n) => {
      const { w } = worldFor(n);
      w.state = 'play';
      let warns = 0;
      for (let t = 0; t < 60; t += 1 / 30) { updateBoss(w, 1 / 30); warns += drainEvents(w).filter((e) => e.t === 'boss-warn').length; w.stun = 1; }
      return warns;
    };
    const mapWarns = count(regular(12)[11]);
    expect(mapWarns).toBeGreaterThan(0);
    expect(mapWarns).toBeLessThan(count(9));
  });

  it('an empty mural is not a win while the boss lives; beating it ends the stage', () => {
    const { w } = worldFor(0);
    launch(w);
    w.grid.remaining = 0;
    stepWorld(w, 1 / 60);
    expect(w.state).toBe('play');
    w.boss.budget = Infinity;
    damageBoss(w, w.boss.hp);
    expect(w.boss.alive).toBe(false);
    expect(w.finale).toBe(true);
    for (let t = 0; t < 5 && w.state !== 'clear'; t += 1 / 60) stepWorld(w, 1 / 60);
    expect(w.state).toBe('clear');
  });

  it('map bosses grow tougher with the stage', () => {
    const [a, b] = [regular(1)[0], regular(30)[29]];
    expect(getLevel(b).boss.hp).toBeGreaterThan(getLevel(a).boss.hp);
  });
});
