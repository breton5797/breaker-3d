import { describe, it, expect } from 'vitest';
import { vivid, hsl } from '../src/render/vivid.js';
import { LAP, BOSSES } from '../src/sim/maps.js';

const all = [...LAP, ...BOSSES].flatMap((m) => m.palette);

describe('vivid brick colours', () => {
  it('returns a #rrggbb colour for every map colour', () => {
    for (const c of all) expect(vivid(c), c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('makes coloured bricks more saturated and keeps their hue', () => {
    for (const c of all) {
      const a = hsl(c);
      if (a.s < 0.15 || a.s > 0.97 || a.l < 0.08 || a.l > 0.92) continue; // greys, already-full colours, near black/white
      const b = hsl(vivid(c));
      expect(b.s, c).toBeGreaterThan(a.s);
      const dh = Math.min(Math.abs(b.h - a.h), 360 - Math.abs(b.h - a.h));
      expect(dh, c).toBeLessThan(4);
    }
  });

  it('lifts dark colours so nothing is muddy', () => {
    for (const c of all) expect(hsl(vivid(c)).l, c).toBeGreaterThanOrEqual(0.3);
  });

  it('greys stay grey (stone and steel must not turn a colour)', () => {
    expect(hsl(vivid('#8a8f99')).s).toBeLessThan(0.2);
    expect(hsl(vivid('#9aa0a8')).s).toBeLessThan(0.2);
  });

  it('whites stay white-ish', () => {
    expect(hsl(vivid('#f4f7fb')).l).toBeGreaterThan(0.9);
  });
});
