import { describe, it, expect } from 'vitest';
import { pickStage, shortCaption, FILMABLE, LINKS } from '../scripts/marketing/caption.mjs';

// Captions for the daily gameplay short (owner, 2026-11-17). Honest copy: what the clip shows, where
// to get the game; no made-up numbers or rankings.
describe('daily short', () => {
  it('picks a filmable stage by date, the same all day, a different one the next day', () => {
    expect(FILMABLE).toContain(pickStage('2026-11-17'));
    expect(pickStage('2026-11-17')).toBe(pickStage('2026-11-17'));
    const week = ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'].map(pickStage);
    expect(new Set(week).size).toBe(7);
  });

  it('writes Korean and English captions with the store links and hashtags', () => {
    const c = shortCaption({ date: '2026-11-17', stage: 12, id: 'sungnyemun', peak: 3883, seconds: 27 });
    expect(c).toMatch(/숭례문/);
    expect(c).toMatch(/Sungnyemun|Namdaemun/i);
    expect(c).toContain('3,883');
    for (const url of Object.values(LINKS)) expect(c).toContain(url);
    expect(c).toMatch(/#BREAKER3D/);
    expect(c).toMatch(/#brickbreaker/i);
    expect(c).not.toMatch(/#1|best game|최고의 게임|1위/i); // no claims we can't back up
  });

  it('a clip that did not reach the clear says so (no clear time claimed)', () => {
    const c = shortCaption({ date: '2026-11-17', stage: 12, id: 'sungnyemun', peak: 812, seconds: null });
    expect(c).toContain('812');
    expect(c).not.toMatch(/초 만에|in \d+ seconds/);
    expect(c).toMatch(/플레이 장면|gameplay/);
  });
});
