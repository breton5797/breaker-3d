// The boss energy bar is three bars stacked: it starts full green, the green drains to
// show a full blue one, and that drains to the red one (owner, 2026-11-02). The red one
// is the protected share (boss.js GUARD_FLOOR): it only drains once the bricks are broken.

export const BLUE_FROM = 0.65; // health share where the green bar is gone and the blue one shows

/**
 * @param {number} share health left (0..1)
 * @param {number} guard the protected share, shown as the red bar
 * @returns {{ color: 'green'|'blue'|'red', width: number, under: 'blue'|'red'|null }}
 *   the bar on top, how full it is (0..1), and the colour showing behind it
 */
export function bossBarLayer(share, guard) {
  const s = Math.max(0, Math.min(1, share));
  if (s > BLUE_FROM) return { color: 'green', width: (s - BLUE_FROM) / (1 - BLUE_FROM), under: 'blue' };
  if (s > guard) return { color: 'blue', width: (s - guard) / (BLUE_FROM - guard), under: 'red' };
  return { color: 'red', width: guard > 0 ? s / guard : 0, under: null };
}
