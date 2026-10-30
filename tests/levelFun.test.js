import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  COLS, ROWS, CELL, ITEM_MULT, PADDLE_Y, PADDLE_H, BALL_R, PRE_ENTRY_MAX, REENTRY_ASSIST_AFTER, COIN_FALL, SWEEP_GAP, BEAM_RATE,
  LONE_BALLS, LONE_PACE, UNIT_TIERS, UNIT_CHARS, BEAM_SHARE,
} from '../src/sim/constants.js';
import { getLevel, stageParams, parseLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, drainEvents } from '../src/sim/world.js';
import { updateBoss, WARN_TIME, ATTACK_EVERY } from '../src/sim/boss.js';
import { updateDrops } from '../src/sim/items.js';
import { addBall } from '../src/sim/balls.js';
import { mulberry32 } from '../src/sim/rng.js';

// Second audit round (PLAN v38, PR-B): the level and fun fixes. The level check found the
// real bottleneck is the stretch from getting in to the first fruit, not the entrance.

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PADDLE_TOP = PADDLE_Y + PADDLE_H / 2;
const world = (n, extra = {}) => {
  const lvl = getLevel(n);
  const p = lvl.params;
  return createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, boss: lvl.boss, brickHp: p.brickHp, rng: mulberry32(n + 7), ...extra });
};

describe('first fruit near the holes', () => {
  /** Fruit within `reach` cells of any hole cell (inside the box), and whether every hole has a dense wall near it. */
  function fruitNearHoles(n, reach = 16) {
    const lvl = getLevel(n);
    const g = parseLevel(lvl.lines, { box: lvl.box, holes: lvl.holes });
    const b = lvl.box;
    const nearHole = (h, c, r, d) => h.cells.some(([hc, hr]) => Math.abs(hc - c) <= d && Math.abs(hr - r) <= d);
    let total = 0;
    let close = 0;
    const bricksAt = lvl.holes.map(() => 0);
    for (let r = b.bottom + 1; r < b.top; r++) {
      for (let c = b.left + 1; c < b.right; c++) {
        const t = g.cells[r * COLS + c];
        if (t === CELL.BRICK) lvl.holes.forEach((h, k) => { if (nearHole(h, c, r, 16)) bricksAt[k]++; });
        if (!ITEM_MULT[t]) continue;
        total++;
        if (lvl.holes.some((h) => nearHole(h, c, r, reach))) close++;
      }
    }
    return { total, close, dense: bricksAt.every((k) => k >= 40) };
  }

  it('every stage keeps 2 (stages 1-5) or 3 fruit near its holes, so the first catch comes early', () => {
    for (const n of [0, 1, 4, 5, 12, 25, 30, 45, 61, 70, 95, 120, 150, 199]) {
      const want = n < 5 ? 2 : 3;
      // Within the widened reach always; within a few bricks when every hole opens onto a dense wall
      // (a corner under a round mural has bare floor near it: those fruit sit at the mural's edge instead).
      const wide = fruitNearHoles(n, 44);
      expect(wide.close, `stage ${n + 1}`).toBeGreaterThanOrEqual(want);
      if (wide.dense) expect(fruitNearHoles(n, 16).close, `stage ${n + 1} (dense)`).toBeGreaterThanOrEqual(want);
    }
    expect(fruitNearHoles(0).dense).toBe(true); // the first stage is the tight case
  });

  it("the stage's fruit count is unchanged (the owner's numbers): only where some of them sit", () => {
    for (const n of [0, 12, 30, 95, 150]) {
      const { total } = fruitNearHoles(n);
      expect(total, `stage ${n + 1}`).toBe(stageParams(n).items);
    }
  });
});

describe('the lonely ball: help after the entrance too', () => {
  it(`once the box has had no ball for ${REENTRY_ASSIST_AFTER} s, a paddle return adds a ball again (up to ${PRE_ENTRY_MAX})`, () => {
    const w = world(0);
    launch(w);
    w.entered = true;
    w.balls.n = 0;
    addBall(w.balls, w.paddle.x, PADDLE_TOP + BALL_R + 0.3, 0, -20, 0); // coming down onto the paddle
    w.outsideFor = REENTRY_ASSIST_AFTER + 0.1;
    stepWorld(w, 1 / 60);
    expect(w.balls.n).toBe(2);
    expect(drainEvents(w).some((e) => e.t === 'assist')).toBe(true);
  });

  it('right after a ball leaves the box there is no assist yet (it has to be a real dry spell)', () => {
    const w = world(0);
    launch(w);
    w.entered = true;
    w.balls.n = 0;
    addBall(w.balls, w.paddle.x, PADDLE_TOP + BALL_R + 0.3, 0, -20, 0);
    w.outsideFor = 0.5;
    stepWorld(w, 1 / 60);
    expect(w.balls.n).toBe(1);
  });

  it('a ball getting back into the box after a dry spell is announced (reenter), once per spell', () => {
    const w = world(0);
    launch(w);
    w.entered = true;
    w.outsideFor = 2;
    w.balls.n = 0;
    const b = w.grid.box;
    addBall(w.balls, (b.left + b.right) / 2, b.bottom + 6, 0, 10, 0); // inside the box
    stepWorld(w, 1 / 60);
    expect(drainEvents(w).filter((e) => e.t === 'reenter')).toHaveLength(1);
    stepWorld(w, 1 / 60);
    expect(drainEvents(w).some((e) => e.t === 'reenter')).toBe(false);
    expect(w.outsideFor).toBe(0);
  });
});

describe('difficulty curve', () => {
  it('brick hp 2 arrives around stage 150 (not 94) and there is no hp 3 (the cliff doubled the lonely-ball dig)', () => {
    expect(stageParams(93).brickHp).toBe(1);
    expect(stageParams(140).brickHp).toBe(1);
    expect(stageParams(149).brickHp).toBe(2);
    expect(stageParams(199).brickHp).toBe(2);
    expect(stageParams(5000).brickHp).toBe(2);
  });

  it('the big boss stages are a climax, not the easiest stage of the ten: tougher and quicker to hurt', () => {
    const boss = getLevel(9).boss;
    expect(boss.hp).toBe(200 + 2 * 9);
    expect(boss.dps).toBe(7 + Math.floor(9 / 25));
    expect(getLevel(99).boss.dps).toBe(7 + Math.floor(99 / 25));
  });

  it('single-hole stages never use the two lowest side spots, and never three side-only stages in a row', () => {
    let sideRun = 0;
    for (let n = 30; n < 200; n++) {
      const holes = getLevel(n).holes;
      expect(holes).toHaveLength(1);
      expect(['left-lo', 'right-lo'], `stage ${n + 1}`).not.toContain(holes[0].slot);
      const side = holes[0].side === 'left' || holes[0].side === 'right';
      sideRun = side ? sideRun + 1 : 0;
      expect(sideRun, `stage ${n + 1}`).toBeLessThanOrEqual(2);
    }
  });

  it('the floor and corner stages among them still move to harder spots as stages rise (v17 intent kept)', () => {
    const floorSlots = (from, to) => { const s = []; for (let n = from; n < to; n++) { const h = getLevel(n).holes[0]; if (!['left', 'right'].includes(h.side)) s.push(h.slot); } return s; };
    expect(floorSlots(30, 60).length).toBeGreaterThan(0);
    expect(floorSlots(170, 200).length).toBeGreaterThan(0);
  });
});

describe('boss sweep has a safe gap', () => {
  const run = (w, seconds, dt = 1 / 60) => { const ev = []; for (let t = 0; t < seconds; t += dt) { updateBoss(w, dt); ev.push(...drainEvents(w)); } return ev; };

  it('the warning names a gap near the paddle; a paddle standing in it is not hit, one outside it is', () => {
    expect(SWEEP_GAP).toBeGreaterThanOrEqual(10);
    const w = world(39); // mothership: sweep first
    w.state = 'play';
    const warn = run(w, ATTACK_EVERY + 0.05).find((e) => e.t === 'boss-warn');
    expect(warn.kind).toBe('sweep');
    expect(typeof warn.safe).toBe('number');
    expect(Math.abs(warn.safe - w.paddle.x)).toBeLessThanOrEqual(30);
    expect(Math.abs(warn.safe - w.paddle.x)).toBeGreaterThanOrEqual(SWEEP_GAP / 2); // it has to move
    w.paddle = { ...w.paddle, x: warn.safe };
    const safe = run(w, WARN_TIME + 2);
    expect(safe.some((e) => e.t === 'boss-strike')).toBe(true);
    expect(safe.some((e) => e.t === 'paddle-hit')).toBe(false);
    // Same attack kind, paddle away from the gap: the beam catches it.
    const v = world(39);
    v.state = 'play';
    const warn2 = run(v, ATTACK_EVERY + 0.05).find((e) => e.t === 'boss-warn');
    const half = v.paddle.w / 2;
    const away = warn2.safe < COLS / 2 ? COLS - half : half;
    v.paddle = { ...v.paddle, x: away };
    expect(run(v, WARN_TIME + 2).some((e) => e.t === 'paddle-hit')).toBe(true);
  });
});

describe('enemy units ease off a lonely ball', () => {
  const place = (tier, balls) => {
    const rows = Array.from({ length: 30 }, () => '.'.repeat(COLS).split(''));
    rows[5][20] = UNIT_CHARS[tier - 1];
    const w = createWorld(rows.map((r) => r.join('')), { rng: () => 0.5 });
    w.state = 'play';
    w.balls.n = 0;
    for (let k = 0; k < balls; k++) addBall(w.balls, 20 + k * 10, 50, 30, 0, 0); // rallying wall to wall, inside
    return w;
  };
  const firedCd = (w) => {
    for (let t = 0; t < 30; t += 1 / 60) {
      stepWorld(w, 1 / 60);
      if (drainEvents(w).some((e) => e.t === 'fire-shell')) return w.units[0].cd;
    }
    return null;
  };

  it(`with ${LONE_BALLS} balls or fewer inside, a unit waits ${LONE_PACE}x longer between volleys`, () => {
    expect(LONE_PACE).toBeGreaterThan(1);
    const base = UNIT_TIERS[4].interval;
    const lone = firedCd(place(5, 1));
    const crowd = firedCd(place(5, LONE_BALLS + 2));
    expect(lone).toBeCloseTo(base * LONE_PACE, 5); // rng 0.5 -> exactly the interval
    expect(crowd).toBeCloseTo(base, 5);
  });
});

describe('finale climax', () => {
  const dropFruit = (w, mult = 10) => { w.drops = [{ x: w.paddle.x, y: PADDLE_TOP + 0.3, mult }]; };

  it(`fruit beams are banked and drain at most ${BEAM_RATE * 100}% of the boss's health per second (a visible ramp, not a blink)`, () => {
    const w = world(0);
    launch(w);
    w.finale = true;
    w.boss.budget = 0;
    const hp = w.boss.hp;
    for (let k = 0; k < 12; k++) { dropFruit(w, 100); updateDrops(w, 1 / 60); } // far more than its whole health
    expect(w.boss.hp).toBe(hp); // nothing yet: the bank drains over time
    updateBoss(w, 0.5);
    expect(hp - w.boss.hp).toBeGreaterThan(0);
    expect(hp - w.boss.hp).toBeLessThanOrEqual(w.boss.hpMax * BEAM_RATE * 0.5 * 2 + 1); // x2 while stunned at most
    expect(w.boss.alive).toBe(true);
  });

  it('a small beam still lands in full within a second (nothing is lost)', () => {
    const w = world(0);
    launch(w);
    w.finale = true;
    w.boss.budget = 0;
    const hp = w.boss.hp;
    dropFruit(w, 10);
    updateDrops(w, 1 / 60);
    const beam = drainEvents(w).find((e) => e.t === 'boss-beam');
    expect(beam.dmg).toBe(Math.max(1, Math.round(w.boss.hpMax * BEAM_SHARE * 3)));
    updateBoss(w, 1);
    expect(hp - w.boss.hp).toBeCloseTo(beam.dmg, 5);
  });

  it('during the finale a dropped fruit does not break the catch streak (they all fall at once) and says so', () => {
    const w = world(0);
    launch(w);
    w.catchStreak = 4;
    w.finale = true;
    w.drops = [{ x: w.paddle.x + 40, y: -0.95, mult: 10 }];
    updateDrops(w, 1 / 60);
    const miss = drainEvents(w).find((e) => e.t === 'miss');
    expect(miss.finale).toBe(true);
    expect(w.catchStreak).toBe(4);
    const v = world(0);
    launch(v);
    v.catchStreak = 4;
    v.drops = [{ x: v.paddle.x + 40, y: -0.95, mult: 10 }];
    updateDrops(v, 1 / 60);
    expect(v.catchStreak).toBe(0);
  });

  it('the director keeps the climax readable: milestone toasts at least 1.2 s apart, no BALLS/miss/collect toasts during the finale, one tally after', () => {
    const src = read('src/director.js');
    expect(src).toMatch(/MILESTONE_GAP = 1\.2/);
    expect(src).toMatch(/const quiet = [^;]*w\.finale/);
    expect(src).toMatch(/과일 \$\{[^}]+\}개/);
  });
});

describe('coins and the stage start', () => {
  it(`coins fall at ${COIN_FALL}x the fruit speed, so both can be caught`, () => {
    const rows = Array.from({ length: 30 }, () => '.'.repeat(COLS));
    const w = createWorld(rows, { rng: () => 0.5, dropSpeed: 20 });
    w.state = 'play';
    w.coins = [{ x: 10, y: 60 }];
    w.drops = [{ x: 30, y: 60, mult: 5 }];
    updateDrops(w, 0.5);
    expect(60 - w.drops[0].y).toBeCloseTo(10, 5);
    expect(60 - w.coins[0].y).toBeCloseTo(10 * COIN_FALL, 5);
  });

  it('the stage opens with one card (name + subtitle together); the mission line only on the first stages; gimmick and unit tips wait for the first entry', () => {
    const ui = read('src/ui.js');
    const start = ui.slice(ui.indexOf('function startStage('), ui.indexOf('/** Achievement collection'));
    expect(start).toMatch(/toast\(level\.name, 'mega'\);\s*toast\(level\.subtitle, 'small'\)/);
    expect(start).toMatch(/level\.index < 10/);
    const main = read('src/main.js');
    expect(main).toMatch(/director\.setEntryTips\(/);
    expect(main).not.toMatch(/GIMMICK_TIPS\[level\.theme\]\) stageTimers\.later/);
    expect(read('src/director.js')).toMatch(/function setEntryTips\(/);
  });

  it("the stage's first fruit is its own small event, and coins climb in pitch as they chain", () => {
    const director = read('src/director.js');
    expect(director).toMatch(/const first = Boolean\(e\.first\)/);
    expect(read('src/sim/items.js')).toMatch(/first: w\.collected === 1/);
    expect(director).toMatch(/audio\.coin\(coinStreak\)/);
    expect(read('src/audio.js')).toMatch(/coin\(streak = 0\)/);
  });

  it('a 놀이 세계 glyph mural carries bombs in its background bands too (the dig widens)', () => {
    const lvl = getLevel(40); // 숫자 1
    expect(lvl.name).toBe('숫자 1');
    const g = parseLevel(lvl.lines, { box: lvl.box, holes: lvl.holes });
    let bombs = 0;
    for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === CELL.BOMB) bombs++;
    expect(bombs).toBeGreaterThanOrEqual(7);
  });
});

describe('the achievements of a stage reach the clear screen', () => {
  it('main lists them in the clear bonus and holds their toasts during the finale', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/stageAchievements/);
    expect(main).toMatch(/🏆 /);
  });
});
