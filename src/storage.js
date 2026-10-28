import { LOADOUT } from './meta.js';
import { BOSS_KINDS } from './sim/boss.js';
import { MAP_BOSSES } from './sim/mapBosses.js';

const KEY = 'breaker3d.v1';
const EMPTY = Object.freeze({
  unlocked: 1, best: {}, muted: false, vibrate: true, adsRemoved: false, achievements: [], gold: 0,
  stars: {}, chests: 0, daily: { last: '', streak: 0 }, loadout: { split: 0, meteor: 0 }, beaten: [],
});
const ACHIEVEMENT_ID = /^[a-z0-9_]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BOSS_IDS = new Set([...BOSS_KINDS, ...Object.values(MAP_BOSSES).map((b) => b.kind)]);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** The meta-game fields (stars, chests, daily streak, bought charges, bosses beaten), checked one by one. */
function metaFields(raw) {
  const stars = {};
  if (raw.stars && typeof raw.stars === 'object') {
    for (const [k, v] of Object.entries(raw.stars)) if (/^\d+$/.test(k) && isInt(v, 1, 3)) stars[k] = v;
  }
  const d = raw.daily;
  const daily = d && typeof d.last === 'string' && DATE.test(d.last) && isInt(d.streak, 1, 3650)
    ? { last: d.last, streak: d.streak } : { last: '', streak: 0 };
  const charge = (kind) => {
    const v = raw.loadout?.[kind];
    return Number.isInteger(v) ? Math.max(0, Math.min(LOADOUT[kind].max, v)) : 0;
  };
  const beaten = Array.isArray(raw.beaten) ? [...new Set(raw.beaten.filter((k) => typeof k === 'string' && BOSS_IDS.has(k)))] : [];
  return {
    stars,
    chests: isInt(raw.chests, 0, 1e6) ? raw.chests : 0,
    daily,
    loadout: { split: charge('split'), meteor: charge('meteor') },
    beaten,
  };
}

/** Reads saved progress; anything malformed falls back to a fresh save. */
export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return structuredClone(EMPTY);
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
    return {
      unlocked, best, muted: raw.muted === true, vibrate: typeof raw.vibrate === 'boolean' ? raw.vibrate : raw.muted !== true,
      adsRemoved: raw.adsRemoved === true, achievements, gold, ...metaFields(raw),
    };
  } catch {
    return structuredClone(EMPTY);
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
