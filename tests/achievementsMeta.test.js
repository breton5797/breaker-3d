import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, earned, achievementGold } from '../src/achievements.js';
import { BOSS_KINDS } from '../src/sim/boss.js';

const stats = (more = {}) => ({
  stage: 0, cleared: false, peakBalls: 0, bestCombo: 0, bestStreak: 0, bestFruit: 0, topKill: 0, livesLost: 0, elapsed: 999,
  totalStars: 0, streak: 0, beaten: [], ...more,
});

describe('mid-game achievements', () => {
  it('beating a big boss, all four, and ten map bosses each count', () => {
    expect(earned(stats({ beaten: ['kraken'] }), [])).toContain('boss_big_1');
    expect(earned(stats({ beaten: [...BOSS_KINDS] }), [])).toContain('boss_big_4');
    expect(earned(stats({ beaten: ['mummy', 'fireDragon', 'mossStag', 'coconutCrab', 'copperGolem', 'ironSpider', 'armoredCrane', 'marblePeacock', 'bronzeHorse'] }), [])).not.toContain('boss_map_10');
    expect(earned(stats({ beaten: ['mummy', 'fireDragon', 'mossStag', 'coconutCrab', 'copperGolem', 'ironSpider', 'armoredCrane', 'marblePeacock', 'bronzeHorse', 'clockGolem'] }), [])).toContain('boss_map_10');
  });

  it('one lap of the world (stage 36), stars and a week-long streak count', () => {
    expect(earned(stats({ cleared: true, stage: 35 }), [])).toContain('lap_one');
    expect(earned(stats({ totalStars: 30 }), [])).toContain('stars_30');
    expect(earned(stats({ totalStars: 90 }), [])).toEqual(expect.arrayContaining(['stars_30', 'stars_90']));
    expect(earned(stats({ streak: 7 }), [])).toContain('streak_7');
  });

  it('every achievement pays gold, and the payout adds up', () => {
    for (const a of ACHIEVEMENTS) expect(a.gold, a.id).toBeGreaterThan(0);
    const ids = ['first_clear', 'stars_30'];
    const sum = ACHIEVEMENTS.filter((a) => ids.includes(a.id)).reduce((s, a) => s + a.gold, 0);
    expect(achievementGold(ids)).toBe(sum);
  });

  it('ids stay unique and valid for the save', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.id).toMatch(/^[a-z0-9_]{1,40}$/);
  });
});
