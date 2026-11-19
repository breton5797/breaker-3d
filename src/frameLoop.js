/**
 * One frame, guarded: a single bad frame (an unexpected state somewhere) must not
 * freeze the game for good, so the loop always carries on. Only if every frame
 * keeps failing does the player get the reload notice (progress is saved).
 * @param {(now: number) => void} step
 * @param {{ maxCrashes?: number, onCrash?: (now: number) => void, onFatal: () => void, schedule?: (f: FrameRequestCallback) => void }} opts
 * @returns {(now: number) => void} the frame callback to hand to requestAnimationFrame
 */
export function guardFrame(step, { maxCrashes = 30, onCrash, onFatal, schedule = (f) => requestAnimationFrame(f) }) {
  let crashes = 0; // frames in a row that threw
  return function frame(now) {
    try {
      step(now);
      crashes = 0;
    } catch (err) {
      crashes++;
      onCrash?.(now);
      if (crashes === 1) console.error(err);
      if (crashes >= maxCrashes) {
        onFatal();
        return;
      }
    }
    schedule(frame);
  };
}
