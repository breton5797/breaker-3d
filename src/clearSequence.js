// The stage-clear screen's choreography: the panel slams in, stars pop one by
// one, the score counts up, stat rows tick in, and the buttons arrive last.
// Kept short: the player wants the next stage.

const STAR_START = 350; // ms after the slam
const STAR_STEP = 300;
const SCORE_GAP = 250; // after the last star
const STAT_GAP = 150; // after the score starts counting
const STAT_STEP = 110;
const BUTTONS_GAP = 250; // after the last stat row
export const SCORE_COUNT_MS = 700;

/**
 * @param {{ stars:number, statCount:number }} p stars earned (0..3), stat rows shown
 * @returns {{ at:number, kind:'slam'|'star'|'score'|'stat'|'buttons', index?:number, earned?:boolean }[]}
 */
export function clearTimeline({ stars, statCount }) {
  const events = [{ at: 0, kind: 'slam' }];
  for (let k = 0; k < 3; k++) events.push({ at: STAR_START + k * STAR_STEP, kind: 'star', index: k, earned: k < stars });
  const scoreAt = STAR_START + 2 * STAR_STEP + SCORE_GAP;
  events.push({ at: scoreAt, kind: 'score' });
  const statStart = scoreAt + STAT_GAP;
  for (let k = 0; k < statCount; k++) events.push({ at: statStart + k * STAT_STEP, kind: 'stat', index: k });
  const lastStat = statCount ? statStart + (statCount - 1) * STAT_STEP : scoreAt;
  events.push({ at: lastStat + BUTTONS_GAP, kind: 'buttons' });
  return events;
}

/**
 * Ease-out count from 0 to `target` over `dur` ms (fast start, gentle landing).
 * @returns {number} whole number shown at time `t`
 */
export function countUp(target, t, dur) {
  if (t >= dur) return target;
  if (t <= 0) return 0;
  const u = t / dur;
  return Math.floor(target * (1 - (1 - u) ** 3));
}
