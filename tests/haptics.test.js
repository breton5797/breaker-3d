import { describe, it, expect } from 'vitest';
import { createHaptics, HAPTICS, fruitHaptic, patternLength } from '../src/haptics.js';

function rig(start = 0) {
  const calls = [];
  let t = start;
  const h = createHaptics({ vibrate: (p) => { calls.push(p); return true; }, now: () => t });
  return { h, calls, advance: (ms) => { t += ms; } };
}

describe('haptics', () => {
  it('plays a named pattern', () => {
    const { h, calls } = rig();
    expect(h.play('boom')).toBe(true);
    expect(calls).toEqual([HAPTICS.boom.pattern]);
  });

  it('ignores unknown names', () => {
    const { h, calls } = rig();
    expect(h.play('nope')).toBe(false);
    expect(calls).toEqual([]);
  });

  it('is silent while disabled', () => {
    const { h, calls } = rig();
    h.setEnabled(false);
    expect(h.play('boom')).toBe(false);
    expect(h.enabled).toBe(false);
    h.setEnabled(true);
    expect(h.play('boom')).toBe(true);
    // Switching off cancels any buzz (vibrate(0)); only one real pattern played.
    expect(calls).toEqual([0, HAPTICS.boom.pattern]);
  });

  it('is unsupported (and silent) without navigator.vibrate', () => {
    const h = createHaptics({ vibrate: null, now: () => 0 });
    expect(h.supported).toBe(false);
    expect(h.play('boom')).toBe(false);
  });

  it('rate-limits the same pattern by its cooldown', () => {
    const { h, calls, advance } = rig();
    h.play('paddle');
    h.play('paddle');
    expect(calls.length).toBe(1);
    advance(HAPTICS.paddle.cooldown);
    h.play('paddle');
    expect(calls.length).toBe(2);
  });

  it('a weaker pattern never cuts off a stronger one still playing', () => {
    const { h, calls, advance } = rig();
    h.play('lost');
    h.play('coin');
    expect(calls).toEqual([HAPTICS.lost.pattern]);
    advance(patternLength(HAPTICS.lost.pattern));
    h.play('coin');
    expect(calls.length).toBe(2);
  });

  it('a stronger pattern interrupts a weaker one', () => {
    const { h, calls } = rig();
    h.play('coin');
    h.play('lethal');
    expect(calls).toEqual([HAPTICS.coin.pattern, HAPTICS.lethal.pattern]);
  });

  it('stop() cancels whatever is buzzing', () => {
    const { h, calls } = rig();
    h.play('over');
    h.stop();
    expect(calls.at(-1)).toBe(0);
    h.play('coin'); // nothing is playing any more, so a weak pattern gets through
    expect(calls.at(-1)).toEqual(HAPTICS.coin.pattern);
  });

  it('survives a vibrate() that throws', () => {
    const h = createHaptics({ vibrate: () => { throw new Error('blocked'); }, now: () => 0 });
    expect(h.play('boom')).toBe(false);
  });

  it('bigger fruit buzz harder', () => {
    expect(fruitHaptic(2)).toBe('fruitS');
    expect(fruitHaptic(5)).toBe('fruitM');
    expect(fruitHaptic(9)).toBe('fruitL');
    expect(HAPTICS.fruitL.priority).toBeGreaterThan(HAPTICS.fruitS.priority);
    expect(patternLength(HAPTICS.fruitL.pattern)).toBeGreaterThan(patternLength(HAPTICS.fruitS.pattern));
  });

  it('keeps every pattern short (no buzz over a second)', () => {
    for (const { pattern } of Object.values(HAPTICS)) expect(patternLength(pattern)).toBeLessThanOrEqual(1000);
  });
});
