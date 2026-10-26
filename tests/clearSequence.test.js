import { describe, it, expect } from 'vitest';
import { clearTimeline, countUp } from '../src/clearSequence.js';

describe('clear screen timeline', () => {
  it('slams in first, then stars, score, stats, and the buttons last', () => {
    const t = clearTimeline({ stars: 3, statCount: 6 });
    const kinds = t.map((e) => e.kind);
    expect(kinds[0]).toBe('slam');
    expect(kinds.at(-1)).toBe('buttons');
    expect(kinds.filter((k) => k === 'star')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'stat')).toHaveLength(6);
    expect(kinds.indexOf('score')).toBeGreaterThan(kinds.lastIndexOf('star'));
    expect(kinds.indexOf('stat')).toBeGreaterThan(kinds.indexOf('score'));
  });

  it('events are in time order and the whole thing is quick (players want the next stage)', () => {
    const t = clearTimeline({ stars: 3, statCount: 6 });
    for (let k = 1; k < t.length; k++) expect(t[k].at).toBeGreaterThanOrEqual(t[k - 1].at);
    expect(t.at(-1).at).toBeLessThanOrEqual(2600);
  });

  it('only earned stars ring; the rest are shown dim', () => {
    const t = clearTimeline({ stars: 1, statCount: 2 });
    const stars = t.filter((e) => e.kind === 'star');
    expect(stars).toHaveLength(3);
    expect(stars.map((s) => s.earned)).toEqual([true, false, false]);
    expect(stars.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('each earned star rings a step higher', () => {
    const t = clearTimeline({ stars: 3, statCount: 0 });
    expect(t.filter((e) => e.kind === 'star').map((s) => s.index)).toEqual([0, 1, 2]);
  });
});

describe('count-up', () => {
  it('starts at 0 and lands exactly on the target', () => {
    expect(countUp(12345, 0, 800)).toBe(0);
    expect(countUp(12345, 800, 800)).toBe(12345);
    expect(countUp(12345, 5000, 800)).toBe(12345);
  });

  it('rises fast then eases in (never overshoots, never goes back)', () => {
    let prev = -1;
    for (let t = 0; t <= 800; t += 16) {
      const v = countUp(1000, t, 800);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1000);
      prev = v;
    }
    expect(countUp(1000, 400, 800)).toBeGreaterThan(500); // ease-out: past half at half time
  });

  it('gives whole numbers', () => {
    expect(Number.isInteger(countUp(999, 333, 800))).toBe(true);
  });
});
