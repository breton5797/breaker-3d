import { describe, it, expect, beforeEach } from 'vitest';
import { loadSave, writeSave, recordClear, unlockAchievements } from '../src/storage.js';

const KEY = 'breaker3d.v1';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

beforeEach(() => { globalThis.localStorage = fakeStorage(); });

describe('save data', () => {
  it('a fresh save has no achievements', () => {
    expect(loadSave()).toEqual({ unlocked: 1, best: {}, muted: false, achievements: [] });
  });

  it('round-trips achievements', () => {
    writeSave({ ...loadSave(), achievements: ['first_clear', 'fever_1'] });
    expect(loadSave().achievements).toEqual(['first_clear', 'fever_1']);
  });

  it('drops malformed or duplicate achievement ids', () => {
    localStorage.setItem(KEY, JSON.stringify({ unlocked: 3, achievements: ['ok_1', 'ok_1', 5, '<b>', null] }));
    const s = loadSave();
    expect(s.achievements).toEqual(['ok_1']);
    expect(s.unlocked).toBe(3);
  });

  it('old saves without achievements still load', () => {
    localStorage.setItem(KEY, JSON.stringify({ unlocked: 7, best: { 2: 900 }, muted: true }));
    expect(loadSave()).toEqual({ unlocked: 7, best: { 2: 900 }, muted: true, achievements: [] });
  });

  it('unlockAchievements returns a new save and never duplicates', () => {
    const s0 = loadSave();
    const s1 = unlockAchievements(s0, ['a', 'b']);
    const s2 = unlockAchievements(s1, ['b', 'c']);
    expect(s0.achievements).toEqual([]);
    expect(s2.achievements).toEqual(['a', 'b', 'c']);
  });

  it('recordClear keeps achievements', () => {
    const s = recordClear({ ...loadSave(), achievements: ['x'] }, 0, 10);
    expect(s.achievements).toEqual(['x']);
  });
});
