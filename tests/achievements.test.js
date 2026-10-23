import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, earned } from '../src/achievements.js';
import { MAX_BALLS } from '../src/sim/constants.js';

const base = {
  stage: 0, cleared: false, peakBalls: 0, bestCombo: 0, bestStreak: 0, bestFruit: 0,
  fevers: 0, topKill: 0, livesLost: 0, elapsed: 99,
};
const ids = (stats, have = []) => earned({ ...base, ...stats }, have);

describe('achievements', () => {
  it('have unique ids, names and descriptions', () => {
    const all = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(12);
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toMatch(/^[a-z0-9_]+$/);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });

  it('nothing is earned by an empty run', () => {
    expect(ids({})).toEqual([]);
  });

  it('clear-only achievements need a clear', () => {
    expect(ids({ elapsed: 5, livesLost: 0 })).toEqual([]);
    expect(ids({ cleared: true, elapsed: 5 })).toEqual(expect.arrayContaining(['first_clear', 'perfect', 'speedrun']));
  });

  it('a clear that lost a life is not perfect', () => {
    expect(ids({ cleared: true, livesLost: 1 })).not.toContain('perfect');
  });

  it('live stats unlock without clearing', () => {
    const got = ids({ peakBalls: MAX_BALLS, bestStreak: 10, fevers: 3, topKill: 10, bestFruit: 100, bestCombo: 1000 });
    expect(got).toEqual(expect.arrayContaining([
      'balls_1000', 'balls_max', 'streak_10', 'fever_1', 'fever_3', 'kill_5', 'kill_10', 'pineapple', 'combo_1000',
    ]));
  });

  it('stage milestones count the stage number (1-based) on clear', () => {
    expect(ids({ cleared: true, stage: 18 })).not.toContain('stage_20');
    expect(ids({ cleared: true, stage: 19 })).toContain('stage_20');
    expect(ids({ cleared: false, stage: 99 })).not.toContain('stage_100');
  });

  it('already unlocked achievements are not reported again', () => {
    expect(ids({ cleared: true }, ['first_clear'])).not.toContain('first_clear');
  });
});
