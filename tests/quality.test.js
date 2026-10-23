import { describe, it, expect } from 'vitest';
import { createQualityGovernor, QUALITY_LEVELS } from '../src/render/quality.js';

const feed = (g, ms, seconds) => {
  const changes = [];
  for (let t = 0; t < seconds; t += ms / 1000) {
    const lv = g.sample(ms / 1000);
    if (lv !== null) changes.push(lv);
  }
  return changes;
};

describe('quality governor', () => {
  it('keeps full quality at 60 fps', () => {
    const g = createQualityGovernor();
    expect(feed(g, 16.7, 10)).toEqual([]);
    expect(g.level).toBe(0);
  });

  it('steps down one level after a sustained slow window', () => {
    const g = createQualityGovernor();
    feed(g, 16.7, 2.5);
    const changes = feed(g, 33, 2.5);
    expect(changes).toEqual([1]);
    expect(g.level).toBe(1);
  });

  it('a display capped at 30 fps (battery saver) is not mistaken for a slow GPU', () => {
    const g = createQualityGovernor();
    expect(feed(g, 33.3, 20)).toEqual([]);
    expect(g.level).toBe(0);
  });

  it('a 30 fps display that slows down further still steps down', () => {
    const g = createQualityGovernor();
    feed(g, 33.3, 2.5);
    expect(feed(g, 55, 2.5)).toEqual([1]);
  });

  it('keeps stepping down while still slow, but never past the lowest level', () => {
    const g = createQualityGovernor();
    feed(g, 16.7, 2.5);
    feed(g, 50, 60);
    expect(g.level).toBe(QUALITY_LEVELS.length - 1);
  });

  it('never steps back up (no flicker between levels)', () => {
    const g = createQualityGovernor();
    feed(g, 16.7, 2.5);
    feed(g, 33, 2.5);
    expect(feed(g, 10, 30)).toEqual([]);
    expect(g.level).toBe(1);
  });

  it('ignores a single long hitch (tab switch, GC)', () => {
    const g = createQualityGovernor();
    feed(g, 16.7, 1);
    g.sample(0.5);
    expect(feed(g, 16.7, 3)).toEqual([]);
  });

  it('can be paused so menus and slow-mo do not count', () => {
    const g = createQualityGovernor();
    g.reset();
    feed(g, 16.7, 1.5);
    g.reset();
    expect(feed(g, 16.7, 2)).toEqual([]);
  });
});
