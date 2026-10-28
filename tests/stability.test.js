import { describe, it, expect, vi } from 'vitest';
import { lruTouch } from '../src/render/bossFit.js';
import { createTimers } from '../src/timers.js';
import { getLevel, levelName } from '../src/sim/levels.js';

describe('boss model cache keeps only the most recent kinds', () => {
  it('touching a kind moves it to the front and drops the oldest beyond the limit', () => {
    let r = lruTouch([], 'a', 2);
    expect(r).toEqual({ list: ['a'], evicted: [] });
    r = lruTouch(r.list, 'b', 2);
    expect(r).toEqual({ list: ['b', 'a'], evicted: [] });
    r = lruTouch(r.list, 'c', 2);
    expect(r).toEqual({ list: ['c', 'b'], evicted: ['a'] });
    r = lruTouch(r.list, 'b', 2);
    expect(r).toEqual({ list: ['b', 'c'], evicted: [] });
  });

  it('never mutates the list it was given', () => {
    const list = Object.freeze(['a', 'b']);
    expect(() => lruTouch(list, 'c', 2)).not.toThrow();
  });
});

describe('timers that belong to a stage can all be called off', () => {
  it('cancelAll stops every pending callback', () => {
    vi.useFakeTimers();
    const t = createTimers();
    const fn = vi.fn();
    t.later(fn, 500);
    t.later(fn, 900);
    t.cancelAll();
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('callbacks that already ran are forgotten, and new ones still fire', () => {
    vi.useFakeTimers();
    const t = createTimers();
    const fn = vi.fn();
    t.later(fn, 100);
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(t.pending()).toBe(0);
    t.cancelAll();
    t.later(fn, 100);
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('stage numbers are never trusted blindly', () => {
  it('a non-finite stage index falls back to the first stage instead of throwing', () => {
    expect(() => getLevel(NaN)).not.toThrow();
    expect(getLevel(NaN).index).toBe(0);
    expect(getLevel(Infinity).index).toBe(0);
    expect(levelName(NaN)).toBe(levelName(0));
  });
});
