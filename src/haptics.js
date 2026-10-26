// Phone vibration, by name. Each pattern has a priority (a weaker buzz never
// cuts off a stronger one still playing) and a cooldown (the same buzz can't
// fire again too soon), so thousands of sim events never turn into a hum.

/** pattern: ms on/off/on... as navigator.vibrate takes it */
export const HAPTICS = Object.freeze({
  paddle: { pattern: 6, priority: 0, cooldown: 140 },
  launch: { pattern: 12, priority: 1, cooldown: 100 },
  coin: { pattern: 10, priority: 1, cooldown: 160 },
  milestone: { pattern: [8, 40, 8], priority: 1, cooldown: 300 },
  laser: { pattern: 18, priority: 2, cooldown: 120 },
  fruitS: { pattern: 16, priority: 2, cooldown: 160 },
  fruitM: { pattern: [18, 35, 22], priority: 3, cooldown: 80 },
  fruitL: { pattern: [25, 30, 25, 30, 45], priority: 4, cooldown: 80 },
  boom: { pattern: [30, 25, 14], priority: 3, cooldown: 110 },
  unitDown: { pattern: [22, 25, 38], priority: 3, cooldown: 120 },
  achievement: { pattern: [14, 45, 14, 45, 28], priority: 3, cooldown: 400 },
  skill: { pattern: [35, 30, 70], priority: 4, cooldown: 200 },
  stun: { pattern: [60, 30, 25], priority: 5, cooldown: 200 },
  lethal: { pattern: [90, 40, 130], priority: 6, cooldown: 200 },
  lost: { pattern: [150, 60, 60], priority: 6, cooldown: 300 },
  clear: { pattern: [30, 70, 30, 70, 110], priority: 5, cooldown: 1000 },
  over: { pattern: [220, 90, 220], priority: 7, cooldown: 1000 },
});

/** @param {number|number[]} pattern @returns {number} total ms */
export const patternLength = (pattern) => (Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern);

/** @param {number} gain the fruit's ball multiplier (x2 ... x10) @returns {string} pattern name */
export const fruitHaptic = (gain) => (gain <= 3 ? 'fruitS' : gain <= 7 ? 'fruitM' : 'fruitL');

const defaultVibrate = () => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null;
  return (p) => navigator.vibrate(p);
};
const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * @param {{ vibrate?: ((p:number|number[])=>boolean) | null, now?: () => number }} [deps]
 */
export function createHaptics({ vibrate = defaultVibrate(), now = defaultNow } = {}) {
  let enabled = true;
  let busyUntil = 0;
  let busyPriority = -1;
  const lastAt = {};

  /** @param {string} name a HAPTICS key @returns {boolean} whether it buzzed */
  function play(name) {
    const spec = HAPTICS[name];
    if (!spec || !vibrate || !enabled) return false;
    const t = now();
    if (lastAt[name] !== undefined && t - lastAt[name] < spec.cooldown) return false;
    if (t < busyUntil && spec.priority < busyPriority) return false;
    try {
      vibrate(spec.pattern);
    } catch {
      return false; // some browsers refuse vibration outside a user gesture
    }
    lastAt[name] = t;
    busyUntil = t + patternLength(spec.pattern);
    busyPriority = spec.priority;
    return true;
  }

  function stop() {
    busyUntil = 0;
    busyPriority = -1;
    if (!vibrate) return;
    try { vibrate(0); } catch { /* ignore */ }
  }

  return {
    play,
    stop,
    setEnabled(on) { enabled = on; if (!on) stop(); },
    get enabled() { return enabled; },
    supported: Boolean(vibrate),
  };
}
