// Game-time pacing: slow-mo for big moments and a split-second "hit-stop"
// freeze on heavy impacts, so a hit lands with weight.

export const HIT_STOP_SCALE = 0.04; // near-freeze, not a full stop (the sim keeps a trickle)
export const HIT_STOP_MAX = 0.12; // longest single freeze, however many hits arrive together
const GRACE = 0.25; // after a freeze, no new freeze for this long (chains keep moving)

export function createPacing() {
  let clock = 0;
  let slow = { scale: 1, until: 0 };
  let stopUntil = 0;
  let graceUntil = 0;

  /** Keeps the deeper of the current and requested slow-mo. */
  function slowMo(scale, seconds) {
    if (scale <= slow.scale || clock > slow.until) slow = { scale, until: clock + seconds };
  }

  /** Near-freeze for `seconds` (capped); ignored while one is running or in its grace period. */
  function hitStop(seconds) {
    if (clock < stopUntil || clock < graceUntil) return;
    const d = Math.min(HIT_STOP_MAX, seconds);
    stopUntil = clock + d;
    graceUntil = stopUntil + GRACE;
  }

  /** @param {number} dt real seconds @returns {number} sim time scale for this frame */
  function tick(dt) {
    clock += dt;
    if (clock <= stopUntil) return HIT_STOP_SCALE;
    if (clock > slow.until) slow = { scale: 1, until: 0 };
    return slow.scale;
  }

  function reset() {
    slow = { scale: 1, until: 0 };
    stopUntil = 0;
    graceUntil = 0;
  }

  return { slowMo, hitStop, tick, reset };
}
