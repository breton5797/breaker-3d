import { describe, it, expect } from 'vitest';
import { planEdit, atempoChain } from '../scripts/marketing/edit.mjs';

// The punchy cut of the daily short (owner, 2026-11-17: "보고 나도 해보고 싶다는 갈구가 생기는 임팩트 있는
// 영상"): a 2 s hook from the peak, the build-up sped up, the climax at real speed, an end card.
const ramp = (len, peakAt, peak) => Array.from({ length: Math.round(len / 0.2) + 1 }, (_, k) => {
  const t = k * 0.2;
  return [t, t < peakAt ? Math.round((t / peakAt) ** 3 * peak) + 1 : peak];
});

describe('planEdit', () => {
  it('hooks with the peak, speeds the build-up, keeps the climax real-time, ends on a card', () => {
    const p = planEdit({ length: 40, samples: ramp(40, 25, 3800), clearAt: 33 });
    expect(p.peak).toBe(3800);
    expect(p.segments.map((s) => s.kind)).toEqual(['hook', 'build', 'climax']);
    const [hook, build, climax] = p.segments;
    expect(hook.to - hook.from).toBeCloseTo(2, 5);
    expect(hook.speed).toBe(1);
    expect(build.from).toBe(0);
    expect(build.speed).toBeGreaterThan(1.5); // a 20+ s build-up squeezed into ~10 s
    expect((build.to - build.from) / build.speed).toBeLessThanOrEqual(10.01);
    expect(climax.speed).toBe(1);
    expect(climax.to).toBeCloseTo(36, 5); // clear + 3 s of the clear screen
    expect(p.total).toBeLessThanOrEqual(30);
    expect(p.endCard).toBe(2.5);
  });

  it('a short build-up is not sped up', () => {
    const p = planEdit({ length: 20, samples: ramp(20, 6, 3000), clearAt: 15 });
    expect(p.segments[1].speed).toBe(1);
  });

  it('a run that never clears ends its climax 6 s after the peak (or at the end)', () => {
    const p = planEdit({ length: 58, samples: ramp(58, 30, 3400), clearAt: null });
    expect(p.segments[2].to).toBeCloseTo(Math.min(58, p.peakAt + 6), 5);
  });

  it('builds atempo chains within ffmpeg limits (each factor 0.5..2)', () => {
    expect(atempoChain(1)).toBe('atempo=1');
    expect(atempoChain(3)).toBe('atempo=2,atempo=1.5');
    expect(atempoChain(5)).toBe('atempo=2,atempo=2,atempo=1.25');
  });
});
