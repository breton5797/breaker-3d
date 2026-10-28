import { describe, it, expect } from 'vitest';
import { aimStep, aimLabel, AIM_LIFT } from '../src/aimInput.js';
import { AIM_MAX } from '../src/sim/aim.js';
import { PADDLE_Y } from '../src/sim/constants.js';

describe('aim input', () => {
  it('a finger just above the paddle already tilts the aim toward it (the paddle stays)', () => {
    expect(AIM_LIFT).toBeLessThanOrEqual(3);
    const step = aimStep({ x: 20, y: PADDLE_Y + 20, paddleX: 20 }, 48, 0);
    expect(step.paddleX).toBeNull();
    expect(step.angle).toBeLessThan(-0.5); // finger up and to the left: aim left
    const right = aimStep({ x: 80, y: PADDLE_Y + 20, paddleX: 80 }, 48, 0);
    expect(right.angle).toBeGreaterThan(0.5);
  });

  it('down at the paddle the finger moves it and the chosen angle is kept', () => {
    const step = aimStep({ x: 30, y: PADDLE_Y - 2, paddleX: 31 }, 48, -0.6);
    expect(step.paddleX).toBe(31);
    expect(step.angle).toBe(-0.6);
  });

  it('the aim never goes flatter than a ball can fly', () => {
    const step = aimStep({ x: 0, y: PADDLE_Y + AIM_LIFT + 0.5, paddleX: 0 }, 90, 0);
    expect(step.angle).toBeCloseTo(-AIM_MAX, 6);
  });

  it('the hint says how to tilt, then shows the angle and which way', () => {
    expect(aimLabel(0, false)).toMatch(/위로/);
    expect(aimLabel(-0.56, true)).toBe('◀ 32° · 손을 떼면 발사');
    expect(aimLabel(0.3, true)).toBe('17° ▶ · 손을 떼면 발사');
    expect(aimLabel(0.005, true)).toBe('수직 · 손을 떼면 발사');
  });
});
