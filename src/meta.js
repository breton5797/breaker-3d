// The meta game around the stages: what gold buys, stars kept per stage and the
// chests they open, a daily first-clear bonus with a streak, bosses beaten, and
// the goals shown on the title. Pure functions over the save (storage.js keeps
// and validates it); every change returns a new save.

import { BOSS_EVERY } from './sim/sequence.js';

/** Extra skill charges bought before a stage (used up when it starts). */
export const LOADOUT = Object.freeze({
  split: Object.freeze({ price: 40, max: 2, name: '분열' }),
  meteor: Object.freeze({ price: 60, max: 2, name: '메테오' }),
});
export const STARS_PER_CHEST = 30;
export const CHEST_GOLD = 150;
/** Daily first-clear gold by streak day (day 1, 2, ...; the last value repeats). */
export const DAILY_GOLD = Object.freeze([100, 125, 150, 175, 200, 250, 300]);

/** @returns {object|null} the save with `n` gold spent, or null if there isn't enough */
export function spendGold(save, n) {
  if (!(n > 0) || save.gold < n) return null;
  return { ...save, gold: save.gold - n };
}

/** @returns {object|null} the save with one more charge of `kind` bought, or null (unknown, full, too poor) */
export function buyLoadout(save, kind) {
  const item = LOADOUT[kind];
  if (!item) return null;
  const have = save.loadout?.[kind] ?? 0;
  if (have >= item.max) return null;
  const paid = spendGold(save, item.price);
  if (!paid) return null;
  return { ...paid, loadout: { split: 0, meteor: 0, ...save.loadout, [kind]: have + 1 } };
}

export const IN_PLAY_MAX = 3; // charges of each skill a stage lets you buy mid-play

/**
 * A skill charge bought mid-stage with gold: the gold picked up this stage goes first, then the banked gold.
 * @param {object} save
 * @param {number} live gold picked up this stage, not banked yet
 * @param {string} kind 'split' | 'meteor'
 * @param {number} bought charges of this kind already bought this stage
 * @returns {{ ok:boolean, save:object, live:number }} unchanged save and live gold when it fails
 */
export function buyInPlay(save, live, kind, bought) {
  const item = LOADOUT[kind];
  const no = { ok: false, save, live };
  if (!item || bought >= IN_PLAY_MAX || save.gold + live < item.price) return no;
  const fromLive = Math.min(live, item.price);
  return { ok: true, save: { ...save, gold: save.gold - (item.price - fromLive) }, live: live - fromLive };
}

/** A stage starts: its bought charges come off the save. */
export function takeLoadout(save) {
  const extra = { split: save.loadout?.split ?? 0, meteor: save.loadout?.meteor ?? 0 };
  return { save: { ...save, loadout: { split: 0, meteor: 0 } }, extra };
}

/** @returns {object} the save with the stage's best star count (1-3) kept */
export function recordStars(save, levelIndex, stars) {
  const prev = save.stars?.[levelIndex] ?? 0;
  return { ...save, stars: { ...save.stars, [levelIndex]: Math.max(prev, stars) } };
}

export const totalStars = (save) => Object.values(save.stars ?? {}).reduce((a, b) => a + b, 0);

/** Opens every chest the stars have earned and not yet opened. */
export function claimChests(save) {
  const due = Math.floor(totalStars(save) / STARS_PER_CHEST) - (save.chests ?? 0);
  if (due <= 0) return { save, gold: 0 };
  const gold = due * CHEST_GOLD;
  return { save: { ...save, chests: (save.chests ?? 0) + due, gold: save.gold + gold }, gold };
}

/** Days since the epoch for a 'YYYY-MM-DD' (local calendar day, no time zone shifts). */
const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Today's calendar date on this device as 'YYYY-MM-DD'. */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The first clear of a day pays DAILY_GOLD by streak; a missed day restarts the
 * streak; a clock set back (date before the last one) pays nothing.
 * @param {object} save
 * @param {string} date 'YYYY-MM-DD'
 */
export function dailyBonus(save, date) {
  const daily = save.daily ?? { last: '', streak: 0 };
  if (daily.last && dayNumber(date) <= dayNumber(daily.last)) return { save, gold: 0, streak: daily.streak };
  const streak = daily.last && dayNumber(date) - dayNumber(daily.last) === 1 ? daily.streak + 1 : 1;
  const gold = DAILY_GOLD[Math.min(streak, DAILY_GOLD.length) - 1];
  return { save: { ...save, daily: { last: date, streak }, gold: save.gold + gold }, gold, streak };
}

/** @returns {object} the save with this boss kind remembered (once) */
export function recordBeaten(save, kind) {
  const beaten = save.beaten ?? [];
  return beaten.includes(kind) ? save : { ...save, beaten: [...beaten, kind] };
}

/** @param {number} next index of the next stage to play @returns {{ toBoss:number }} stages before the next big boss */
export function nextGoals(next) {
  const toBoss = (BOSS_EVERY - 1 - (next % BOSS_EVERY) + BOSS_EVERY) % BOSS_EVERY;
  return { toBoss };
}

/** @returns {number} percent of the mural broken (0-100) */
export function progressShare(grid) {
  return grid.total > 0 ? Math.round((100 * (grid.total - grid.remaining)) / grid.total) : 0;
}
