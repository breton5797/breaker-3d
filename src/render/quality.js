// Automatic quality: when frames stay slow, step down one level at a time.
// Never steps back up, so the picture can't flicker between levels.
export const QUALITY_LEVELS = Object.freeze([
  { name: 'high', trails: true, ballShadows: true, shadows: true, pixelRatio: 2 },
  { name: 'medium', trails: true, ballShadows: false, shadows: true, pixelRatio: 2 },
  { name: 'low', trails: false, ballShadows: false, shadows: true, pixelRatio: 1 },
  { name: 'lowest', trails: false, ballShadows: false, shadows: false, pixelRatio: 1 },
]);

const WINDOW = 2; // seconds of frames averaged per decision
const SLOW = 1 / 45; // average frame time above this counts as slow...
const SLOWDOWN = 1.3; // ...and so does falling this far behind the best window seen
const HITCH = 0.25; // single frames longer than this are ignored (tab switch, GC)

/**
 * Feed it real (unclamped) frame times. The best window seen is the display's
 * own pace, so a phone capped at 30 fps (battery saver) is not "slow" by itself.
 * @returns {{ sample:(dt:number)=>number|null, reset:()=>void, readonly level:number }}
 */
export function createQualityGovernor() {
  let level = 0;
  let total = 0;
  let frames = 0;
  let best = Infinity;

  function reset() { total = 0; frames = 0; }

  /** @returns {number|null} the new level when it changed, else null */
  function sample(dt) {
    if (dt > HITCH || level >= QUALITY_LEVELS.length - 1) return null;
    total += dt;
    frames++;
    if (total < WINDOW) return null;
    const avg = total / frames;
    reset();
    best = Math.min(best, avg);
    const slow = avg > Math.max(SLOW, best * SLOWDOWN);
    if (!slow) return null;
    level++;
    return level;
  }

  return { sample, reset, get level() { return level; } };
}
