// The meta game around the stages: what gold buys, stars kept per stage and the
// chests they open, a daily first-clear bonus with a streak, bosses beaten, and
// the goals shown on the title. Pure functions over the save (storage.js keeps
// and validates it); every change returns a new save.

import { BOSS_EVERY } from './sim/sequence.js';

/** What the old title shop charged for a next-stage charge (only to refund saves that still hold some). */
export const LOADOUT = Object.freeze({
  split: Object.freeze({ price: 40, max: 2, name: '분열' }),
  meteor: Object.freeze({ price: 60, max: 2, name: '메테오' }),
});
/** Skills are bought with coins during a stage (no free charges): split by multiplier, meteor at one price. */
export const SKILL_PRICES = Object.freeze({
  split: Object.freeze({ 2: 30, 3: 50, 4: 80, 5: 120 }),
  meteor: 60,
});
export const SKILL_USES = 2; // uses of each skill per stage at most (owner, 2026-10-29)
export const STARS_PER_CHEST = 30;
export const CHEST_GOLD = 150;
/** Daily first-clear gold by streak day (day 1, 2, ...; the last value repeats). */
export const DAILY_GOLD = Object.freeze([100, 125, 150, 175, 200, 250, 300]);

/** @returns {object|null} the save with `n` gold spent, or null if there isn't enough */
export function spendGold(save, n) {
  if (!(n > 0) || save.gold < n) return null;
  return { ...save, gold: save.gold - n };
}

/**
 * @param {string} kind 'split' | 'meteor'
 * @param {number} [mult] split multiplier (2-5)
 * @returns {number|undefined} the coin price, or undefined for anything not on sale
 */
export function skillPrice(kind, mult) {
  if (kind === 'meteor') return SKILL_PRICES.meteor;
  if (kind === 'split') return SKILL_PRICES.split[mult];
  return undefined;
}

/**
 * A skill bought mid-stage with coins: those picked up this stage go first, then the banked ones.
 * @param {object} save
 * @param {number} live coins picked up this stage, not banked yet
 * @param {string} kind 'split' | 'meteor'
 * @param {number} used uses of this skill so far this stage
 * @param {number} [mult] split multiplier (2-5)
 * @returns {{ ok:boolean, save:object, live:number }} unchanged save and live coins when it fails
 */
export function buyInPlay(save, live, kind, used, mult = 3) {
  const price = skillPrice(kind, mult);
  const no = { ok: false, save, live };
  if (!price || used >= SKILL_USES || save.gold + live < price) return no;
  const fromLive = Math.min(live, price);
  return { ok: true, save: { ...save, gold: save.gold - (price - fromLive) }, live: live - fromLive };
}

/** Charges still held from the old title shop come back as the gold they cost (that shop is gone). */
export function refundLoadout(save) {
  const split = save.loadout?.split ?? 0;
  const meteor = save.loadout?.meteor ?? 0;
  if (!split && !meteor) return save;
  return { ...save, gold: save.gold + split * LOADOUT.split.price + meteor * LOADOUT.meteor.price, loadout: { split: 0, meteor: 0 } };
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
