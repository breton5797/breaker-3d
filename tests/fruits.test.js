import { describe, it, expect } from 'vitest';
import { ITEM_MULT } from '../src/sim/constants.js';
import { FRUITS, fruitFor } from '../src/fruits.js';

describe('fruit items', () => {
  it('every multiplier item is a distinct fruit with a name', () => {
    const mults = [...new Set(Object.values(ITEM_MULT))].sort((a, b) => a - b);
    const emojis = mults.map((m) => fruitFor(m).emoji);
    expect(new Set(emojis).size).toBe(mults.length);
    for (const m of mults) {
      expect(fruitFor(m).name.length).toBeGreaterThan(0);
      expect(fruitFor(m).color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('fruits are listed from the smallest to the biggest reward', () => {
    const order = FRUITS.map((f) => f.mult);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('unknown values fall back to the smallest fruit', () => {
    expect(fruitFor(7)).toBe(FRUITS[0]);
  });
});
