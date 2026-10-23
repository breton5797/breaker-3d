const KEY = 'breaker3d.v1';
const EMPTY = Object.freeze({ unlocked: 1, best: {}, muted: false });

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
    return { unlocked, best, muted: raw.muted === true };
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
