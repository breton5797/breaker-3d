// Difficulty curve for an endless run of stages. Step knobs (hole width, brick
// hp, items, lives, paddle, unit tier/count) ramp over the first 200 stages
// and then hold at their hardest; two continuous knobs (fruit fall speed and
// unit aggression) rise on every single stage forever, approaching a ceiling
// so the game stays playable. Nothing ever gets easier.

const RAMP_STAGES = 200; // step knobs reach their hardest value here
const UNITS_FROM = 5; // stages 1-5 have no enemy units
const STAGES_PER_TIER = 19; // a new unit tier every 19 stages; tier 10 arrives at stage 177

export const BASE_RATE = 4.5;
export const PACE_WORK = 7000;

const lerp = (a, b, t) => a + (b - a) * t;
/** Rises from 0 toward 1 forever, strictly increasing. */
const approach = (n, scale) => 1 - Math.exp(-n / scale);

/**
 * @param {number} i zero-based stage index (0, 1, 2, ... no upper limit)
 * @returns {{ holeW:number, brickHp:number, items:number, bigItemShare:number,
 *   releaseRate:number, lives:number, paddleW:number, unitTop:number, unitCount:number,
 *   dropSpeed:number, aggression:number }}
 */
export function stageParams(i) {
  const n = Math.max(0, Math.floor(i));
  const d = Math.min(1, n / (RAMP_STAGES - 1));
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
    unitCount: armed ? Math.min(12, 2 + Math.floor((n - UNITS_FROM) / 16)) : 0,
    dropSpeed: 13 + 13 * approach(n, 250), // cells/s a fruit falls: 13 -> 26
    aggression: 1 + 0.6 * approach(n, 500), // unit fire-rate/bomb-speed factor: 1 -> 1.6
  };
}
