// Difficulty curve for the 200 stages. Every knob is a monotone function of
// d = 0 (stage 1, beginner) .. 1 (stage 200, hardest), so each stage is a
// little harder than the one before and never easier.

export const STAGE_COUNT = 200;
const UNITS_FROM = 5; // stages 1-5 have no enemy units
const STAGES_PER_TIER = 19; // a new unit tier every 19 stages; tier 10 arrives at stage 177

export const BASE_RATE = 4.5;
export const PACE_WORK = 7000;

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * @param {number} i zero-based stage index (0..199)
 * @returns {{ holeW:number, brickHp:number, items:number, bigItemShare:number,
 *   releaseRate:number, lives:number, paddleW:number, unitTop:number, unitCount:number }}
 */
export function stageParams(i) {
  const n = Math.max(0, Math.min(STAGE_COUNT - 1, i));
  const d = n / (STAGE_COUNT - 1);
  const armed = n >= UNITS_FROM;
  return {
    holeW: Math.max(2, Math.round(lerp(14, 2, Math.pow(d, 0.7)))), // fine cells
    brickHp: Math.min(3, 1 + Math.floor(2.5 * Math.pow(d, 1.2))),
    items: Math.round(lerp(80, 55, d)),
    bigItemShare: lerp(0.6, 0.3, d), // chance an item is x20 or more
    // Balls released per second for a reference wall of PACE_WORK brick-hits;
    // getLevel scales it to the actual wall so every stage clears in about
    // 1.5-2 minutes after the first fruit is caught.
    releaseRate: BASE_RATE,
    lives: n < 10 ? 5 : n < 50 ? 4 : 3,
    paddleW: Math.round(lerp(18, 10, d)),
    unitTop: armed ? Math.min(10, 1 + Math.floor((n - UNITS_FROM) / STAGES_PER_TIER)) : 0,
    unitCount: armed ? Math.min(14, 2 + Math.floor((n - UNITS_FROM) / 14)) : 0,
  };
}
