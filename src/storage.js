const KEY = 'breaker3d.v1';
const EMPTY = Object.freeze({ unlocked: 1, best: {}, muted: false, vibrate: true, achievements: [], gold: 0 });
const ACHIEVEMENT_ID = /^[a-z0-9_]{1,40}$/;

/** Reads saved progress; anything malformed falls back to a fresh save. */
export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    const unlocked = Number.isInteger(raw.unlocked) && raw.unlocked > 0 ? Math.min(raw.unlocked, 1_000_000) : 1;
    const best = {};
    if (raw.best && typeof raw.best === 'object') {
      for (const [k, v] of Object.entries(raw.best)) {
        if (/^\d+$/.test(k) && Number.isFinite(v) && v >= 0) best[k] = Math.floor(v);
      }
    }
    const ids = Array.isArray(raw.achievements) ? raw.achievements : [];
    const achievements = [...new Set(ids.filter((id) => typeof id === 'string' && ACHIEVEMENT_ID.test(id)))];
    const gold = Number.isInteger(raw.gold) && raw.gold > 0 ? Math.min(raw.gold, 1e12) : 0;
    return { unlocked, best, muted: raw.muted === true, vibrate: typeof raw.vibrate === 'boolean' ? raw.vibrate : raw.muted !== true, achievements, gold };
  } catch {
    return { ...EMPTY };
  }
}

/** Persists progress; storage can be unavailable (private mode), which is fine. */
export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // ignore: progress just won't persist
  }
}

/** @returns {object} a new save with the stage result folded in */
export function recordClear(save, levelIndex, score) {
  const prev = save.best[levelIndex] ?? 0;
  return {
    ...save,
    unlocked: Math.max(save.unlocked, levelIndex + 2),
    best: { ...save.best, [levelIndex]: Math.max(prev, score) },
  };
}

/** @returns {object} a new save with the given achievement ids added (no duplicates) */
export function unlockAchievements(save, ids) {
  return { ...save, achievements: [...new Set([...save.achievements, ...ids])] };
}

/** @returns {object} a new save with `amount` gold banked (never below zero) */
export function addGold(save, amount) {
  return { ...save, gold: Math.max(0, (save.gold ?? 0) + Math.floor(amount)) };
}
