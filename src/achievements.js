import { MAX_BALLS } from './sim/constants.js';
import { BOSS_KINDS } from './sim/boss.js';

const bigBeaten = (s) => (s.beaten ?? []).filter((k) => BOSS_KINDS.includes(k)).length;
const mapBeaten = (s) => (s.beaten ?? []).filter((k) => !BOSS_KINDS.includes(k)).length;

/**
 * Persistent badges; each pays `gold` once when unlocked. Each test reads one run's stats:
 * { stage (0-based), cleared, peakBalls, bestCombo, bestStreak, bestFruit, topKill, livesLost, elapsed,
 *   totalStars, streak (daily), beaten (boss kinds ever beaten) }
 */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_clear', icon: '🏁', name: '첫 클리어', desc: '스테이지를 처음으로 클리어', gold: 50, test: (s) => s.cleared },
  { id: 'perfect', icon: '💖', name: '무결점', desc: '목숨을 하나도 잃지 않고 클리어', gold: 100, test: (s) => s.cleared && s.livesLost === 0 },
  { id: 'speedrun', icon: '⚡', name: '번개 클리어', desc: '30초 안에 클리어', gold: 100, test: (s) => s.cleared && s.elapsed <= 30 },
  { id: 'balls_1000', icon: '⚪', name: '천 개의 공', desc: '공 1,000개 동시 달성', gold: 50, test: (s) => s.peakBalls >= 1000 },
  { id: 'balls_max', icon: '🌕', name: '공의 바다', desc: `공 ${MAX_BALLS.toLocaleString('ko-KR')}개(최대치) 달성`, gold: 200, test: (s) => s.peakBalls >= MAX_BALLS },
  { id: 'combo_1000', icon: '🔗', name: '콤보 장인', desc: '콤보 1,000 달성', gold: 150, test: (s) => s.bestCombo >= 1000 },
  { id: 'streak_10', icon: '🧺', name: '과일 바구니', desc: '과일 10개 연속 받기', gold: 100, test: (s) => s.bestStreak >= 10 },
  { id: 'pineapple', icon: '🍍', name: '황금 파인애플', desc: '파인애플(×10) 받기', gold: 100, test: (s) => s.bestFruit >= 100 },
  { id: 'kill_5', icon: '🎯', name: '저격수 사냥', desc: 'Lv.5 이상 유닛 격파', gold: 150, test: (s) => s.topKill >= 5 },
  { id: 'kill_10', icon: '👑', name: '파괴신 처단', desc: 'Lv.10 파괴신 격파', gold: 500, test: (s) => s.topKill >= 10 },
  { id: 'stage_20', icon: '🥉', name: '20 스테이지', desc: '스테이지 20 클리어', gold: 150, test: (s) => s.cleared && s.stage + 1 >= 20 },
  { id: 'stage_50', icon: '🥈', name: '50 스테이지', desc: '스테이지 50 클리어', gold: 300, test: (s) => s.cleared && s.stage + 1 >= 50 },
  { id: 'stage_100', icon: '🥇', name: '100 스테이지', desc: '스테이지 100 클리어', gold: 500, test: (s) => s.cleared && s.stage + 1 >= 100 },
  // The mid game: bosses, one trip round the world, stars and coming back daily.
  { id: 'boss_big_1', icon: '🗿', name: '거인 사냥', desc: '대형 보스 처음 격파', gold: 100, test: (s) => bigBeaten(s) >= 1 },
  { id: 'boss_big_4', icon: '🏆', name: '4대 보스 정복', desc: '대형 보스 4종 모두 격파', gold: 500, test: (s) => bigBeaten(s) >= BOSS_KINDS.length },
  { id: 'boss_map_10', icon: '🐉', name: '보스 사냥꾼', desc: '서로 다른 맵 보스 10종 격파', gold: 200, test: (s) => mapBeaten(s) >= 10 },
  { id: 'lap_one', icon: '🌍', name: '세계 일주', desc: '스테이지 36(첫 바퀴) 클리어', gold: 300, test: (s) => s.cleared && s.stage + 1 >= 36 },
  { id: 'stars_30', icon: '⭐', name: '별 30개', desc: '별 30개 모으기', gold: 100, test: (s) => (s.totalStars ?? 0) >= 30 },
  { id: 'stars_90', icon: '🌟', name: '별 90개', desc: '별 90개 모으기', gold: 300, test: (s) => (s.totalStars ?? 0) >= 90 },
  { id: 'streak_7', icon: '📅', name: '개근', desc: '7일 연속 클리어', gold: 300, test: (s) => (s.streak ?? 0) >= 7 },
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

/** @param {string[]} ids @returns {number} the gold these achievements pay together */
export const achievementGold = (ids) => ACHIEVEMENTS.filter((a) => ids.includes(a.id)).reduce((sum, a) => sum + a.gold, 0);
