// Unit pressure curve (brainstorm 2026-11-24, option 2). The stage layouts keep
// their unit tiers (stages.js, levels.js: saves and replays see the same maps),
// but how hard those units press the paddle is rescaled per stage so the
// difficulty climbs smoothly instead of staying flat to ~175 and then hitting a
// wall at ~180 (docs/brainstorm/2026-11-24-difficulty/baseline-data.md).
//
// Pressure P = expected seconds of paddle stun per second while units fire:
//   sum over units of (shots x aggression / interval) x stun.
// pressureParams(n) returns factors so that basePressure(n) x fire x stun equals
// targetPressure(n). Fixed per stage number: never adapts to the player.

import { UNIT_TIERS } from './constants.js';
import { stageParams } from './stages.js';

// Target curve, fitted with scripts/difficulty-baseline.mjs (see docs/brainstorm/.../pressure-fit.md).
const P_START = 0.25; // pressure at the first armed stage
const P_CEIL = 4.2; // the curve approaches this and never reaches it
const P_SCALE = 260; // stages to cover ~63% of the way from start to ceiling

const UNITS_FROM = 5;
const rate = (tier, aggression) => {
  const s = UNIT_TIERS[tier - 1];
  return ((s.shots * aggression) / s.interval) * s.stun;
};

/** Expected pressure of the stage's own units (commander at the top tier, squad 1-3 tiers below). */
export function basePressure(n) {
  const p = stageParams(n);
  if (!p.unitCount) return 0;
  const top = p.unitTop;
  let squad = 0;
  for (let k = 0; k < 3; k++) squad += rate(Math.max(1, top - 1 - k), p.aggression) / 3;
  return rate(top, p.aggression) + (p.unitCount - 1) * squad;
}

/** The pressure stage n should have: rises on every stage, approaching P_CEIL. */
export function targetPressure(n) {
  const k = Math.max(0, n - UNITS_FROM);
  return P_START + (P_CEIL - P_START) * (1 - Math.exp(-k / P_SCALE));
}

/**
 * @param {number} n zero-based stage index
 * @returns {{ fire:number, stun:number }} fire divides the units' volley interval, stun scales a bomb's stun.
 *   Stun never grows (a frozen paddle is no fun): extra pressure comes from more frequent volleys.
 */
export function pressureParams(n) {
  const base = basePressure(n);
  if (base <= 0) return { fire: 1, stun: 1 };
  const s = targetPressure(n) / base;
  const stun = Math.min(1, Math.sqrt(s));
  return { fire: s / stun, stun };
}
