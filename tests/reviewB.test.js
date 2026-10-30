import { describe, it, expect } from 'vitest';
import { getLevel, stageParams, parseLevel } from '../src/sim/levels.js';
import { createWorld, launch, useSkill, stepWorld, drainEvents } from '../src/sim/world.js';
import { updateDrops } from '../src/sim/items.js';
import { updateBoss, damageBoss, PHASE3, ATTACK_EVERY } from '../src/sim/boss.js';
import { createDirector } from '../src/director.js';
import { COLS, ITEM_MULT, PADDLE_Y, PADDLE_H, SWEEP_GAP } from '../src/sim/constants.js';
import { stageSlot } from '../src/sim/sequence.js';
import { landmarkAt } from '../src/sim/maps.js';
import { mulberry32 } from '../src/sim/rng.js';

// The PR-B review's findings, as behaviour (not source patterns).

const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;
const world = (n, extra = {}) => {
  const lvl = getLevel(n);
  return createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, boss: lvl.boss, brickHp: lvl.params.brickHp, rng: mulberry32(n + 7), ...extra });
};

/** A director with every dependency stubbed; `toasts` records what the UI was asked to show. */
function director() {
  const toasts = [];
  const noop = new Proxy(function stub() {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => ({ x: 0, y: 0 }) }); // any depth, any call
  const ui = new Proxy({ toast: (content) => toasts.push(Array.isArray(content) ? content.map((p) => (typeof p === 'string' ? p : p.small ?? p.big ?? p.emoji ?? '')).join('') : content), fmt: (n) => String(n) }, { get: (t, k) => (k in t ? t[k] : () => ({ x: 0, y: 0 })) });
  const d = createDirector({ stage: noop, bricks: noop, fx: noop, audio: noop, ui, units3d: noop, coins3d: noop, haptics: noop, gimmicks3d: noop, boss3d: noop });
  return { d, toasts };
}
const w0 = (over = {}) => ({ finale: false, boss: null, balls: { n: 1 }, combo: 0, time: 0, collected: 0, state: 'play', entered: true, grid: { remaining: 100 }, paddle: { x: 48, w: 12 }, ...over });

describe('finale quiet mode keeps its marks', () => {
  it('a combo that ran out during the finale does not re-announce its milestone after the KO', () => {
    const { d, toasts } = director();
    const w = w0({ combo: 150, time: 1 });
    d.handle([], w); // COMBO 100 announced
    expect(toasts.filter((t) => /COMBO/.test(t))).toHaveLength(1);
    const quiet = w0({ finale: true, boss: { alive: true }, combo: 0, time: 5 });
    d.handle([], quiet); // the combo timer ran out while the toasts were held
    const after = w0({ finale: true, boss: { alive: false }, combo: 120, time: 9 });
    d.handle([], after);
    expect(toasts.filter((t) => /COMBO/.test(t))).toHaveLength(1);
  });

  it('collect toasts are held while the finale runs with the boss up, then summed up once', () => {
    const { d, toasts } = director();
    const w = w0({ finale: true, boss: { alive: true, x: 0, y: 0 }, time: 2, collected: 3 });
    const collect = (n) => ({ t: 'collect', x: 48, mult: 10, gain: 3, n, streak: 1, overflow: 0, first: false });
    d.handle([collect(30), collect(90), collect(270)], w);
    expect(toasts).toHaveLength(0);
  });
});

describe('the first fruit is decided when it is caught', () => {
  it('two fruit caught in the same step: exactly one carries first=true', () => {
    const w = world(0);
    launch(w);
    w.drops = [{ x: w.paddle.x - 2, y: PADDLE_TOP + 0.3, mult: 5 }, { x: w.paddle.x + 2, y: PADDLE_TOP + 0.3, mult: 5 }];
    updateDrops(w, 1 / 60);
    const catches = drainEvents(w).filter((e) => e.t === 'collect');
    expect(catches).toHaveLength(2);
    expect(catches.map((e) => e.first)).toEqual([true, false]);
  });
});

describe('level seeding', () => {
  it('every stage of the first 200 has exactly its fruit count (overlapping hole zones never eat one)', () => {
    for (let n = 0; n < 200; n++) {
      const slot = stageSlot(n);
      if (slot.boss || landmarkAt(slot.content).mosaic) continue; // mosaics scale their fruit with the bricks
      const lvl = getLevel(n);
      const g = parseLevel(lvl.lines, { box: lvl.box, holes: lvl.holes });
      let items = 0;
      for (let i = 0; i < g.cells.length; i++) if (ITEM_MULT[g.cells[i]]) items++;
      expect(items, `stage ${n + 1}`).toBe(stageParams(n).items);
    }
  });
});

describe('boss beam damage', () => {
  it('a beam that breaks the armour keeps the stun bonus budget (so balls still land during the stun)', () => {
    const w = world(0);
    launch(w);
    w.finale = true;
    const b = w.boss;
    b.hp = b.hpMax * (PHASE3 + 0.01);
    b.budget = 0;
    b.beamBank = b.hpMax * 0.05; // enough to cross PHASE3
    updateBoss(w, 1 / 60); // drains at 20%/s: 0.33% per frame
    for (let k = 0; k < 20 && b.phase < 3; k++) updateBoss(w, 1 / 60);
    expect(b.phase).toBe(3);
    expect(b.stun).toBeGreaterThan(0);
    expect(b.budget).toBeGreaterThan(b.dps); // the stun bonus (dps * STUN_TIME) survived the beam
  });
});

describe('serves and sweeps', () => {
  it('a meteor served from the paddle is a fresh serve: the opening assist state resets', () => {
    const w = world(0, { charges: { split: 0, meteor: 1 } });
    w.entered = true;
    w.outsideFor = 9;
    expect(useSkill(w, 'meteor')).toBe(true);
    expect(w.entered).toBe(false);
    expect(w.outsideFor).toBe(0);
  });

  it('the sweep gap is never narrower than the paddle, and the hit is judged where the beam is drawn', () => {
    const w = world(39);
    w.state = 'play';
    let warn = null;
    for (let t = 0; t < ATTACK_EVERY + 0.1 && !warn; t += 1 / 60) { updateBoss(w, 1 / 60); warn = drainEvents(w).find((e) => e.t === 'boss-warn'); }
    expect(warn.kind).toBe('sweep');
    expect(warn.gap).toBeGreaterThanOrEqual(Math.max(SWEEP_GAP, w.paddle.w + 2));
    // Standing at the gap's edge, the paddle overlaps where an invisible beam would be: no hit.
    w.paddle = { ...w.paddle, x: warn.safe + warn.gap / 2 - w.paddle.w / 2 };
    for (let t = 0; t < 3; t += 1 / 60) { updateBoss(w, 1 / 60); }
    expect(drainEvents(w).some((e) => e.t === 'paddle-hit')).toBe(false);
  });
});
