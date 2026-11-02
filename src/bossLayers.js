// The boss energy bar is one green-blue-red gradient (owner, 2026-11-02). Full, it shows all
// three colours; as the boss loses health it shrinks from the green end, so the green goes
// first, then the blue, then the red. Each colour spans its share of health: green down to
// BLUE_FROM, blue down to the protected share (boss.js GUARD_FLOOR), red the rest, which only
// drains once the bricks are broken.

export const BLUE_FROM = 0.65; // health share where the green is gone and the blue starts going

/**
 * @param {number} share health left (0..1)
 * @param {number} guard the protected share, drawn red
 * @returns {{ width: number, size: number, greenEnd: number, redStart: number }}
 *   width: how much of the bar is filled (0..1); size: how wide the gradient is drawn
 *   compared with the fill (so the colours stay put while the fill shrinks);
 *   greenEnd / redStart: where blue begins and red begins along the full bar (0..1, left to right)
 */
export function bossBarFill(share, guard) {
  const width = Math.max(0, Math.min(1, share));
  return { width, size: 1 / Math.max(width, 0.001), greenEnd: 1 - BLUE_FROM, redStart: 1 - guard };
}
