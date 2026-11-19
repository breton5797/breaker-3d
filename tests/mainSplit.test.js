import { describe, it, expect, vi } from 'vitest';
import { aimText, serveText } from '../src/serveHints.js';
import { guardFrame } from '../src/frameLoop.js';
import { t } from '../src/i18n.js';

// Pieces split out of main.js (kept under 800 lines, owner's file-size rule, 2026-11-19).
describe('serve hints', () => {
  it('mouse aim: the hint, straight up, or the angle with its side', () => {
    expect(aimText(0.3, false)).toBe(t('aim.hint'));
    expect(aimText(0, true)).toBe(t('aim.vertical'));
    expect(aimText(Math.PI / 6, true)).toBe(t('aim.angle', { angle: '30° ▶' }));
    expect(aimText(-Math.PI / 6, true)).toBe(t('aim.angle', { angle: '◀ 30°' }));
  });

  it('touch serve: place, aim, cancel, then the angle', () => {
    expect(serveText({ phase: 'place', id: null })).toBe(`◀ ${t('serve.place')} ▶`);
    expect(serveText({ phase: 'aim', id: null })).toBe(t('serve.aim'));
    expect(serveText({ phase: 'aim', id: 1, cancel: true })).toBe(t('serve.cancel'));
    expect(serveText({ phase: 'aim', id: 1, cancel: false, angle: 0 })).toBe(t('aim.vertical'));
  });
});

describe('guarded frame loop', () => {
  it('keeps going after a bad frame and stops with a notice only after many in a row', () => {
    const queue = [];
    const onFatal = vi.fn();
    const onCrash = vi.fn();
    let bad = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const frame = guardFrame(() => { if (bad) throw new Error('x'); }, { maxCrashes: 3, onCrash, onFatal, schedule: (f) => queue.push(f) });
    frame(1);
    frame(2);
    expect(queue).toHaveLength(2); // still scheduling
    expect(onCrash).toHaveBeenLastCalledWith(2);
    bad = false;
    frame(3); // a good frame resets the count
    bad = true;
    frame(4);
    frame(5);
    expect(onFatal).not.toHaveBeenCalled();
    frame(6);
    expect(onFatal).toHaveBeenCalledOnce();
    expect(queue).toHaveLength(5); // the fatal frame schedules nothing
    expect(spy).toHaveBeenCalledTimes(2); // logged once per run of failures
    spy.mockRestore();
  });
});
