// Daily missions and the weekly challenge (owner, 2026-11-16: "매일, 매주 이벤트로 재방문율 고도화";
// plan approved: 3 daily missions 50/80/120 gold + 150 for all three, weekly 3 tiers 200/400/800 and a
// week stamp). GAME_PSYCHOLOGY P1-P4: every reward is fixed gold or a stamp, nothing random or paid,
// no countdown pressure, and a missed day costs nothing. Missions come from the date alone.
// Pure functions over the save; main.js tracks play, eventsView.js draws it.

import { dayNumber } from './meta.js';
import { mulberry32 } from './sim/rng.js';

export const METRICS = Object.freeze(['fruit', 'clear', 'boss', 'coin', 'skill', 'pipe', 'stars3']);
export const MISSION_GOLD = Object.freeze([50, 80, 120]); // easy, normal, hard
export const ALL_DONE_GOLD = 150;
export const WEEKLY_GOLD = Object.freeze([200, 400, 800]);
const TIERS = ['easy', 'normal', 'hard'];
const PIPE_UNLOCK = 10; // pipes start at stage 10 (sim/pipes.js): no pipe missions before it opens

// What each tier can ask for, in a day. Goals sized for one to three sessions.
const POOL = Object.freeze({
  easy: [['fruit', 5], ['clear', 2], ['coin', 60], ['skill', 1], ['boss', 1]],
  normal: [['fruit', 15], ['clear', 4], ['boss', 2], ['coin', 180], ['pipe', 1], ['stars3', 2]],
  hard: [['fruit', 40], ['clear', 8], ['boss', 4], ['coin', 450], ['pipe', 3], ['stars3', 4]],
});
// The weekly goal, one per week in turn.
const WEEKLY = Object.freeze([
  { metric: 'clear', goals: [10, 25, 50] },
  { metric: 'fruit', goals: [40, 120, 300] },
  { metric: 'boss', goals: [8, 20, 45] },
  { metric: 'coin', goals: [400, 1200, 3000] },
]);

const isoOf = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const weekIndex = (iso) => Math.floor((dayNumber(iso) + 3) / 7); // day 0 (1970-01-01) was a Thursday

/** @param {string} iso 'YYYY-MM-DD' @returns {string} the Monday that starts its week */
export const weekOf = (iso) => isoOf(weekIndex(iso) * 7 - 3);

/**
 * The day's three missions (easy, normal, hard), each a different thing to do.
 * @param {string} date @param {number} unlocked stages open (pipe missions need stage 10)
 */
export function dailyMissions(date, unlocked) {
  const rng = mulberry32(dayNumber(date) * 7919 + 17);
  const used = new Set();
  return TIERS.map((tier, i) => {
    const pool = POOL[tier].filter(([metric]) => !used.has(metric) && (metric !== 'pipe' || unlocked >= PIPE_UNLOCK));
    const [metric, goal] = pool[Math.floor(rng() * pool.length)];
    used.add(metric);
    return Object.freeze({ tier, metric, goal, gold: MISSION_GOLD[i] });
  });
}

/** @param {string} date @returns {{ week: string, metric: string, goals: number[], gold: number[] }} */
export function weeklyChallenge(date) {
  const { metric, goals } = WEEKLY[weekIndex(date) % WEEKLY.length];
  return { week: weekOf(date), metric, goals: [...goals], gold: [...WEEKLY_GOLD] };
}

const EMPTY = Object.freeze({ day: '', missions: [], dp: {}, dc: [false, false, false], bonus: false, week: '', wp: {}, wc: [false, false, false], stamps: [] });

/**
 * The events state brought up to `date`: a new day or week starts fresh (stamps stay). A date before
 * the stored one (a clock turned back) gives null: nothing is tracked or paid until the clock catches up.
 */
function current(save, date) {
  const ev = { ...EMPTY, ...(save.events ?? {}) };
  if (ev.day && dayNumber(date) < dayNumber(ev.day)) return null;
  const day = ev.day === date ? {} : { day: date, missions: dailyMissions(date, save.unlocked ?? 1), dp: {}, dc: [false, false, false], bonus: false };
  const week = weekOf(date);
  const wk = ev.week === week ? {} : { week, wp: {}, wc: [false, false, false] };
  return { ...ev, ...day, ...wk };
}

const add = (counts, more) => {
  const out = { ...counts };
  for (const [k, v] of Object.entries(more)) if (METRICS.includes(k) && Number.isFinite(v) && v > 0) out[k] = (out[k] ?? 0) + Math.floor(v);
  return out;
};

/** Adds what was just played. @param {Record<string, number>} counts metric -> how many */
export function track(save, date, counts) {
  const ev = current(save, date);
  if (!ev) return save;
  return { ...save, events: { ...ev, dp: add(ev.dp, counts), wp: add(ev.wp, counts) } };
}

const pay = (save, ev, gold) => ({ save: { ...save, events: ev, gold: (save.gold ?? 0) + gold }, gold });
// A claim pays double only after a rewarded ad (or free after "remove ads"): main.js claimEvent. Anything else pays once.
const times = (mult) => (mult === 2 ? 2 : 1);
const none = (save) => ({ save, gold: 0 });

/** Claims daily mission i (0-2) once it is done; mult 2 pays double (rewarded ad). */
export function claimMission(save, date, i, mult = 1) {
  const ev = current(save, date);
  const m = ev?.missions[i];
  if (!m || ev.dc[i] || (ev.dp[m.metric] ?? 0) < m.goal) return none(save);
  return pay(save, { ...ev, dc: ev.dc.map((c, k) => c || k === i) }, m.gold * times(mult));
}

/** The bonus for claiming all three of the day's missions. */
export function claimAllBonus(save, date, mult = 1) {
  const ev = current(save, date);
  if (!ev || ev.bonus || !ev.dc.every(Boolean)) return none(save);
  return pay(save, { ...ev, bonus: true }, ALL_DONE_GOLD * times(mult));
}

/** Claims weekly tier k (0-2), in order; the last one also keeps the week's stamp. */
export function claimWeekly(save, date, k, mult = 1) {
  const ev = current(save, date);
  const w = weeklyChallenge(date);
  if (!ev || ev.wc[k] || (k > 0 && !ev.wc[k - 1]) || (ev.wp[w.metric] ?? 0) < w.goals[k]) return none(save);
  const stamps = k === 2 && !ev.stamps.includes(w.week) ? [...ev.stamps, w.week] : ev.stamps;
  return pay(save, { ...ev, wc: ev.wc.map((c, j) => c || j === k), stamps }, w.gold[k] * times(mult));
}

const TALLY = { collect: 'fruit', skill: 'skill' };

/**
 * Counts a frame's sim events into the stage tally: fruit caught, skills used and, on a pipe stage,
 * each serve that got in past the pipe ('enter' fires once a serve is beyond it; world.js).
 * @param {Record<string, number>} tally @param {Array<{t: string}>} events @param {boolean} pipe
 */
export function tallyEvents(tally, events, pipe) {
  const out = { ...tally };
  for (const e of events) {
    const metric = TALLY[e.t] ?? (pipe && e.t === 'enter' ? 'pipe' : null);
    if (metric) out[metric] = (out[metric] ?? 0) + 1;
  }
  return out;
}

/** The stage's tally plus how it ended: a clear, a boss beaten, coins banked, a three-star clear. */
export function stageCounts(tally, { won, boss, coins, stars }) {
  return {
    ...tally,
    ...(won ? { clear: 1 } : {}),
    ...(won && boss ? { boss: 1 } : {}),
    ...(coins > 0 ? { coin: coins } : {}),
    ...(won && stars === 3 ? { stars3: 1 } : {}),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const flags = (v) => [0, 1, 2].map((k) => Array.isArray(v) && v[k] === true);
const counts = (v) => (v && typeof v === 'object' ? add({}, v) : {});
const isOwnMission = (m, i) => {
  const tier = TIERS[i];
  return m && m.tier === tier && m.gold === MISSION_GOLD[i] && POOL[tier].some(([metric, goal]) => metric === m.metric && goal === m.goal);
};

/**
 * Checks a saved events state field by field (storage.js). A day whose missions are not real ones
 * (an edited save) or that lies more than a day ahead (a wrong clock) starts over; stamps are kept.
 * @param {unknown} raw @param {string} todayIso
 */
export function cleanEvents(raw, todayIso) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const ahead = (iso) => typeof iso !== 'string' || !DATE.test(iso) || dayNumber(iso) > dayNumber(todayIso) + 1;
  const missions = Array.isArray(r.missions) ? r.missions : [];
  const dayOk = !ahead(r.day) && missions.length === 3 && missions.every(isOwnMission);
  const day = dayOk
    ? { day: r.day, missions: missions.map(({ tier, metric, goal, gold }) => Object.freeze({ tier, metric, goal, gold })), dp: counts(r.dp), dc: flags(r.dc), bonus: r.bonus === true }
    : { day: '', missions: [], dp: {}, dc: [false, false, false], bonus: false };
  const weekOk = !ahead(r.week) && weekOf(r.week) === r.week;
  const week = weekOk ? { week: r.week, wp: counts(r.wp), wc: flags(r.wc) } : { week: '', wp: {}, wc: [false, false, false] };
  const stamps = Array.isArray(r.stamps) ? [...new Set(r.stamps.filter((s) => typeof s === 'string' && DATE.test(s) && weekOf(s) === s))] : [];
  return { ...day, ...week, stamps };
}

/** Everything the events panel and the title button show. */
export function eventsStatus(save, date) {
  const ev = current(save, date) ?? { ...EMPTY, ...(save.events ?? {}) };
  const missions = ev.missions.map((m, i) => {
    const progress = Math.min(m.goal, ev.dp[m.metric] ?? 0);
    return { ...m, progress, done: progress >= m.goal, claimed: Boolean(ev.dc[i]) };
  });
  const w = weeklyChallenge(date);
  const wprog = ev.wp[w.metric] ?? 0;
  const weekly = { ...w, progress: wprog, claimed: [...ev.wc], ready: w.goals.map((g, k) => !ev.wc[k] && wprog >= g && (k === 0 || ev.wc[k - 1])) };
  const bonusReady = !ev.bonus && ev.dc.every(Boolean) && missions.length === 3;
  const claimable = missions.filter((m) => m.done && !m.claimed).length + (bonusReady ? 1 : 0) + weekly.ready.filter(Boolean).length;
  return {
    missions,
    bonus: { gold: ALL_DONE_GOLD, ready: bonusReady, claimed: Boolean(ev.bonus) },
    weekly,
    weeklyTier: ev.wc.filter(Boolean).length,
    stamps: [...ev.stamps],
    done: missions.filter((m) => m.done).length,
    claimable,
  };
}
