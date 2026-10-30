import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  nextGoals, dailyStatus, chestProgress, firstClearBonus, FIRST_CLEAR_GOLD, recordBeaten, dailyBonus, DAILY_GOLD, STARS_PER_CHEST, recordStars,
} from '../src/meta.js';
import { ACHIEVEMENTS, earned, lapEndStage } from '../src/achievements.js';
import { loadSave, writeSave, recordClear } from '../src/storage.js';
import { bossDex, travelAlbum, collectionCounts } from '../src/collection.js';
import { stageOfContent } from '../src/sim/sequence.js';
import { LAP, LEVELS, WONDERS } from '../src/sim/maps.js';
import { BOSS_KINDS } from '../src/sim/boss.js';
import { MAP_BOSSES } from '../src/sim/mapBosses.js';

// Second audit round (PLAN v38, PR-C): reasons to come back, made visible.

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const KEY = 'breaker3d.v1';
function fakeStorage(failing = false) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (failing) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
}
beforeEach(() => { globalThis.localStorage = fakeStorage(); });
const base = () => loadSave();
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysFromNow = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return iso(d); };

describe('stage order helpers', () => {
  it('stageOfContent finds the stage a regular map sits on (bosses take every 10th)', () => {
    expect(stageOfContent(0)).toBe(0);
    expect(stageOfContent(8)).toBe(8);
    expect(stageOfContent(9)).toBe(10); // stage index 9 is a boss
    expect(stageOfContent(24)).toBe(26); // 경이의 세계 opens on stage 27
    expect(stageOfContent(LAP.length - 1)).toBe(65); // the lap ends on stage 66
  });
});

describe('the next goal is concrete', () => {
  it('names the next big boss and the next chapter with the stages to go', () => {
    const g = nextGoals(0);
    expect(g.toBoss).toBe(9);
    expect(g.bossName).toBe('석상 거인');
    expect(g.toChapter).toBe(26);
    expect(g.chapterName).toBe('경이의 세계');
    expect(g.chapterId).toBe('wonders');
    expect(g.bossKind).toBe('colossus');
    expect(nextGoals(26)).toMatchObject({ toChapter: 0, chapterName: '경이의 세계' });
    expect(nextGoals(40)).toMatchObject({ toChapter: 0, chapterName: '놀이 세계', chapterId: 'play' });
    const later = nextGoals(41); // past the last opener of the lap: the next lap's first chapter
    expect(later.chapterName).toBe('경이의 세계');
    expect(later.toChapter).toBe(stageOfContent(LAP.length + LEVELS.length) - 41);
    expect(nextGoals(4).toBoss).toBe(5); // as before
  });
});

describe('the title shows the daily bonus and the next chest', () => {
  it('dailyStatus: unclaimed today, claimed today, and after a gap', () => {
    const today = daysFromNow(0);
    expect(dailyStatus(base(), today)).toEqual({ claimed: false, streak: 0, nextGold: DAILY_GOLD[0] });
    const s = dailyBonus(base(), today).save;
    expect(dailyStatus(s, today)).toEqual({ claimed: true, streak: 1, nextGold: DAILY_GOLD[1] });
    expect(dailyStatus(s, daysFromNow(1))).toEqual({ claimed: false, streak: 1, nextGold: DAILY_GOLD[1] });
    expect(dailyStatus(s, daysFromNow(3))).toEqual({ claimed: false, streak: 0, nextGold: DAILY_GOLD[0] }); // the streak would start over
  });

  it('chestProgress counts the stars to the next chest', () => {
    expect(chestProgress(base())).toEqual({ stars: 0, toNext: STARS_PER_CHEST });
    let s = base();
    for (let i = 0; i < 6; i++) s = recordStars(s, i, 3); // 18 stars
    expect(chestProgress(s)).toEqual({ stars: 18, toNext: STARS_PER_CHEST - 18 });
    for (let i = 6; i < 10; i++) s = recordStars(s, i, 3); // 30 stars: a chest is due, the next is 30 away
    expect(chestProgress(s)).toEqual({ stars: 30, toNext: STARS_PER_CHEST });
  });
});

describe('gold for a first clear (owner, 2026-10-30)', () => {
  it(`a stage's first clear pays ${FIRST_CLEAR_GOLD} gold, a replay pays none`, () => {
    expect(FIRST_CLEAR_GOLD).toBe(20);
    const s = base();
    expect(firstClearBonus(s, 3)).toBe(FIRST_CLEAR_GOLD);
    expect(firstClearBonus(recordClear(s, 3, 500), 3)).toBe(0);
    expect(firstClearBonus(recordClear(s, 3, 500), 4)).toBe(FIRST_CLEAR_GOLD);
  });
});

describe('achievements keep up with the longer lap', () => {
  const stats = (more = {}) => ({
    stage: 0, cleared: false, peakBalls: 0, bestCombo: 0, bestStreak: 0, bestFruit: 0, topKill: 0, livesLost: 0, elapsed: 999,
    totalStars: 0, streak: 0, beaten: [], ...more,
  });

  it('one lap of the world is the 60 maps (stage 66), not 36', () => {
    expect(lapEndStage()).toBe(65);
    expect(earned(stats({ cleared: true, stage: 35 }), [])).not.toContain('lap_one');
    expect(earned(stats({ cleared: true, stage: 65 }), [])).toContain('lap_one');
    expect(ACHIEVEMENTS.find((a) => a.id === 'lap_one').desc).toMatch(/66/);
  });

  it('finishing each chapter is its own achievement (랜드마크 26판, 경이 39판, 놀이 66판)', () => {
    expect(earned(stats({ cleared: true, stage: 25 }), [])).toContain('chapter_landmarks');
    expect(earned(stats({ cleared: true, stage: 24 }), [])).not.toContain('chapter_landmarks');
    expect(earned(stats({ cleared: true, stage: stageOfContent(LEVELS.length + WONDERS.length - 1) }), [])).toContain('chapter_wonders');
    expect(earned(stats({ cleared: true, stage: 65 }), [])).toContain('chapter_play');
  });

  it('collecting bosses pays: 20 kinds and all 40 (fixed rewards, nothing random)', () => {
    const kinds = [...new Set([...BOSS_KINDS, ...Object.values(MAP_BOSSES).map((b) => b.kind)])];
    expect(kinds).toHaveLength(40);
    expect(earned(stats({ beaten: kinds.slice(0, 19) }), [])).not.toContain('dex_20');
    expect(earned(stats({ beaten: kinds.slice(0, 20) }), [])).toContain('dex_20');
    expect(earned(stats({ beaten: kinds }), [])).toContain('dex_40');
  });

  it('countable achievements expose their progress (current, goal) for the list', () => {
    const by = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
    expect(by.stars_30.progress(stats({ totalStars: 17 }))).toEqual([17, 30]);
    expect(by.streak_7.progress(stats({ streak: 3 }))).toEqual([3, 7]);
    expect(by.boss_map_10.progress(stats({ beaten: ['mummy', 'kraken'] }))).toEqual([1, 10]);
    expect(by.stage_50.progress(stats({ stage: 11, cleared: true }))).toEqual([12, 50]);
    expect(by.perfect.progress).toBeUndefined(); // a one-off, nothing to count
  });
});

describe('save data', () => {
  it('remembers the stage a boss was first beaten on, validated on load', () => {
    const s = recordBeaten(recordBeaten(base(), 'mummy', 3), 'mummy', 9);
    expect(s.beatenAt).toEqual({ mummy: 3 });
    writeSave(s);
    expect(loadSave().beatenAt).toEqual({ mummy: 3 });
    localStorage.setItem(KEY, JSON.stringify({ beaten: ['mummy', 'ghost'], beatenAt: { mummy: 3.5, ghost: 1, kraken: -2, colossus: 7 } }));
    expect(loadSave().beatenAt).toEqual({ colossus: 7 });
    expect(loadSave().beaten).toEqual(['mummy']);
  });

  it('a daily date in the future (a clock that was ahead) is reset, so the bonus is not locked for years', () => {
    localStorage.setItem(KEY, JSON.stringify({ daily: { last: daysFromNow(400), streak: 3 } }));
    expect(loadSave().daily).toEqual({ last: '', streak: 0 });
    localStorage.setItem(KEY, JSON.stringify({ daily: { last: daysFromNow(1), streak: 3 } })); // a day ahead: time zones, kept
    expect(loadSave().daily).toEqual({ last: daysFromNow(1), streak: 3 });
  });

  it('writeSave says whether it could save (so the game can warn once)', () => {
    expect(writeSave(base())).toBe(true);
    globalThis.localStorage = fakeStorage(true);
    expect(writeSave(base())).toBe(false);
  });
});

describe('boss dex and travel album (data the game already saves)', () => {
  it('lists the 40 bosses, the big four first, each with its portrait name and whether/where it was beaten', () => {
    const s = recordBeaten(recordBeaten(base(), 'kraken', 19), 'mummy', 0);
    const dex = bossDex(s);
    expect(dex).toHaveLength(40);
    expect(dex.slice(0, 4).map((e) => e.kind)).toEqual([...BOSS_KINDS]);
    expect(dex[1]).toMatchObject({ kind: 'kraken', name: '크라켄', big: true, beaten: true, metAt: 19 });
    expect(dex[0].name).not.toMatch(/BOSS/);
    const mummy = dex.find((e) => e.kind === 'mummy');
    expect(mummy).toMatchObject({ name: '미라 파라오', beaten: true, metAt: 0, big: false });
    expect(dex.filter((e) => e.beaten)).toHaveLength(2);
  });

  it('the album has one card per map of the lap with its best stars across laps and the sunset/night stamps', () => {
    let s = recordClear(recordStars(base(), 0, 2), 0, 500); // 기자 피라미드, lap 1, two stars
    const second = stageOfContent(LAP.length); // the same map in lap 2 (sunset)
    s = recordClear(recordStars(s, second, 3), second, 900);
    const album = travelAlbum(s);
    expect(album).toHaveLength(LAP.length);
    expect(album[0]).toMatchObject({ id: 'giza', cleared: true, bestStars: 3, stamps: { sunset: true, night: false } });
    expect(album[1]).toMatchObject({ cleared: false, bestStars: 0, stamps: { sunset: false, night: false } });
    expect(album[0].photo).toBe('giza');
    expect(album.find((m) => m.id === 'num1').photo).toBeNull(); // glyph murals have a palette tile instead
  });

  it('counts for the title button and the chapter bars', () => {
    let s = base();
    for (let k = 0; k < LEVELS.length; k++) s = recordClear(s, stageOfContent(k), 100);
    const c = collectionCounts(recordBeaten(s, 'mummy', 0));
    expect(c.bosses).toEqual({ have: 1, total: 40 });
    expect(c.maps).toEqual({ have: LEVELS.length, total: LAP.length });
    expect(c.chapters[0]).toMatchObject({ name: '세계 랜드마크', have: LEVELS.length, total: LEVELS.length });
    expect(c.chapters[1]).toMatchObject({ name: '경이의 세계', have: 0, total: WONDERS.length });
  });
});

describe('wiring', () => {
  it('the meteor hint only points at a meteor the player can buy; otherwise it points at the coins', () => {
    const director = read('src/director.js');
    expect(director).toMatch(/canAfford\(SKILL_PRICES\.meteor\)/);
    expect(director).toMatch(/t\('game\.coinHint'\)/);
    expect(read('src/main.js')).toMatch(/canAfford: \(price\) =>/);
  });

  it('saving goes through one place that warns once when it cannot persist', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/function persist\(\)/);
    expect(main).not.toMatch(/\bwriteSave\(save\);/);
    expect(main).toMatch(/t\('stage\.saveFail'\)/);
  });

  it('the game-over screen reports the gold kept and a tip; the title has the collection button; the clear screen shows stars to the chest', () => {
    const html = read('index.html');
    for (const id of ['over-gold', 'over-tip', 'btn-collection', 'screen-collection', 'clear-meta', 'collection-tab-boss', 'collection-tab-travel']) expect(html, id).toContain(`id="${id}"`);
    const ui = read('src/ui.js');
    expect(ui).toMatch(/function showCollection\(/);
    expect(ui).toMatch(/achv-gold/);
    expect(read('src/collectionView.js')).toMatch(/grayscale|dim/);
  });
});
