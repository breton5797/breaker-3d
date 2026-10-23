import { MAX_BALLS } from './sim/constants.js';

/**
 * Persistent badges. Each test reads one run's stats:
 * { stage (0-based), cleared, peakBalls, bestCombo, bestStreak, bestFruit, topKill, livesLost, elapsed }
 */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_clear', icon: '🏁', name: '첫 클리어', desc: '스테이지를 처음으로 클리어', test: (s) => s.cleared },
  { id: 'perfect', icon: '💖', name: '무결점', desc: '목숨을 하나도 잃지 않고 클리어', test: (s) => s.cleared && s.livesLost === 0 },
  { id: 'speedrun', icon: '⚡', name: '번개 클리어', desc: '30초 안에 클리어', test: (s) => s.cleared && s.elapsed <= 30 },
  { id: 'balls_1000', icon: '⚪', name: '천 개의 공', desc: '공 1,000개 동시 달성', test: (s) => s.peakBalls >= 1000 },
  { id: 'balls_max', icon: '🌕', name: '공의 바다', desc: `공 ${MAX_BALLS.toLocaleString('ko-KR')}개(최대치) 달성`, test: (s) => s.peakBalls >= MAX_BALLS },
  { id: 'combo_1000', icon: '🔗', name: '콤보 장인', desc: '콤보 1,000 달성', test: (s) => s.bestCombo >= 1000 },
  { id: 'streak_10', icon: '🧺', name: '과일 바구니', desc: '과일 10개 연속 받기', test: (s) => s.bestStreak >= 10 },
  { id: 'pineapple', icon: '🍍', name: '황금 파인애플', desc: '파인애플(×50) 받기', test: (s) => s.bestFruit >= 100 },
  { id: 'kill_5', icon: '🎯', name: '저격수 사냥', desc: 'Lv.5 이상 유닛 격파', test: (s) => s.topKill >= 5 },
  { id: 'kill_10', icon: '👑', name: '파괴신 처단', desc: 'Lv.10 파괴신 격파', test: (s) => s.topKill >= 10 },
  { id: 'stage_20', icon: '🥉', name: '20 스테이지', desc: '스테이지 20 클리어', test: (s) => s.cleared && s.stage + 1 >= 20 },
  { id: 'stage_50', icon: '🥈', name: '50 스테이지', desc: '스테이지 50 클리어', test: (s) => s.cleared && s.stage + 1 >= 50 },
  { id: 'stage_100', icon: '🥇', name: '100 스테이지', desc: '스테이지 100 클리어', test: (s) => s.cleared && s.stage + 1 >= 100 },
]);

/**
 * @param {object} stats one run's stats (see ACHIEVEMENTS)
 * @param {string[]} have ids already unlocked
 * @returns {string[]} ids newly earned by these stats
 */
export function earned(stats, have) {
  const owned = new Set(have);
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && a.test(stats)).map((a) => a.id);
}
