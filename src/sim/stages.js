// Difficulty curve for an endless run of stages. Step knobs (hole width, brick
// hp, items, lives, paddle, unit tier/count) ramp over the first 200 stages
// and then hold at their hardest; two continuous knobs (fruit fall speed and
// unit aggression) rise on every single stage forever, approaching a ceiling
// so the game stays playable. Nothing ever gets easier.

import { RELEASE_RATE } from './constants.js';

const RAMP_STAGES = 200; // step knobs reach their hardest value here
const UNITS_FROM = 5; // stages 1-5 have no enemy units
const STAGES_PER_TIER = 19; // a new unit tier every 19 stages; tier 10 arrives at stage 177
// The entrance hardens a little at a time: it narrows one cell every
// HOLE_STEP stages, drifts off-centre from SHIFT_FROM, and gains a steel guard
// underneath from GUARD_FROM.
const HOLE_START = 16;
const HOLE_STEP = 14; // 16 cells at stage 1 ... 2 cells from stage 197
const SHIFT_FROM = 10;
const SHIFT_STEP = 0.025; // per 5 stages, as a share of the room to the wall
const SHIFT_MAX = 0.8;
const GUARD_FROM = 60;
const GUARD_EVERY = 40;
const GUARD_MAX = 4;

const lerp = (a, b, t) => a + (b - a) * t;
/** Rises from 0 toward 1 forever, strictly increasing. */
const approach = (n, scale) => 1 - Math.exp(-n / scale);

/**
 * @param {number} i zero-based stage index (0, 1, 2, ... no upper limit)
 * @returns {{ holeW:number, holeShift:number, guard:number, brickHp:number, items:number, bigItemShare:number,
 *   releaseRate:number, lives:number, paddleW:number, unitTop:number, unitCount:number,
 *   dropSpeed:number, aggression:number }}
 */
export function stageParams(i) {
  const n = Math.max(0, Math.floor(i));
  const d = Math.min(1, n / (RAMP_STAGES - 1));
  const armed = n >= UNITS_FROM;
  return {
    holeW: Math.max(2, HOLE_START - Math.floor(n / HOLE_STEP)), // fine cells
    holeShift: n < SHIFT_FROM ? 0 : Math.min(SHIFT_MAX, Math.floor((n - SHIFT_FROM) / 5) * SHIFT_STEP),
    guard: n < GUARD_FROM ? 0 : Math.min(GUARD_MAX, 1 + Math.floor((n - GUARD_FROM) / GUARD_EVERY)),
    brickHp: Math.min(3, 1 + Math.floor(2.5 * Math.pow(d, 1.2))),
    items: Math.round(lerp(80, 55, d)),
    bigItemShare: lerp(0.6, 0.3, d), // chance an item is x20 or more
    releaseRate: RELEASE_RATE, // minimum release speed of caught balls
    lives: n < 10 ? 5 : n < 50 ? 4 : 3,
    paddleW: Math.round(lerp(18, 10, d)),
    unitTop: armed ? Math.min(10, 1 + Math.floor((n - UNITS_FROM) / STAGES_PER_TIER)) : 0,
    unitCount: armed ? Math.min(12, 2 + Math.floor((n - UNITS_FROM) / 16)) : 0,
    dropSpeed: 13 + 13 * approach(n, 250), // cells/s a fruit falls: 13 -> 26
    aggression: 1 + 0.6 * approach(n, 500), // unit fire-rate/bomb-speed factor: 1 -> 1.6
  };
}
