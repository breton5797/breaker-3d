import { describe, it, expect } from 'vitest';
import { createCamFx, SHAKE_MAX } from '../src/render/camfx.js';

const settle = (c, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) c.step(dt); };

describe('camera fx', () => {
  it('rests at zero offset', () => {
    const c = createCamFx({ seed: 1 });
    c.step(1 / 60);
    expect(c.offset).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('shake moves the camera, smoothly, and dies out', () => {
    const c = createCamFx({ seed: 1 });
    c.shake(1);
    c.step(1 / 60);
    const a = { ...c.offset };
    c.step(1 / 60);
    const b = { ...c.offset };
    expect(Math.hypot(a.x, a.y)).toBeGreaterThan(0);
    // Smooth noise: consecutive frames stay close (white noise would jump the full amplitude).
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.5);
    settle(c, 2);
    expect(Math.hypot(c.offset.x, c.offset.y, c.offset.z)).toBeLessThan(1e-3);
  });

  it('shake is capped', () => {
    const c = createCamFx({ seed: 2 });
    for (let k = 0; k < 50; k++) c.shake(1);
    expect(c.trauma).toBeLessThanOrEqual(SHAKE_MAX);
  });

  it('a kick pushes the camera that way, then springs back', () => {
    const c = createCamFx({ seed: 3 });
    c.kick(0, 0, -2);
    c.step(1 / 60);
    c.step(1 / 60);
    expect(c.offset.z).toBeLessThan(0);
    settle(c, 2);
    expect(Math.abs(c.offset.z)).toBeLessThan(1e-3);
  });

  it('many kicks in one frame do not add up past a cap', () => {
    const one = createCamFx({ seed: 5 });
    const many = createCamFx({ seed: 5 });
    one.kick(0, 0, -2);
    for (let k = 0; k < 20; k++) many.kick(0, 0, -2);
    one.step(1 / 60); many.step(1 / 60);
    expect(Math.abs(many.offset.z)).toBeLessThan(Math.abs(one.offset.z) * 2.5);
  });

  it('reduced motion scales everything down', () => {
    const full = createCamFx({ seed: 4 });
    const calm = createCamFx({ seed: 4, reduced: true });
    full.kick(3, 0, 0); calm.kick(3, 0, 0);
    full.step(1 / 30); calm.step(1 / 30);
    expect(Math.abs(calm.offset.x)).toBeLessThan(Math.abs(full.offset.x));
  });
});
