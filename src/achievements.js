import { MAX_BALLS } from './sim/constants.js';
import { BOSS_KINDS } from './sim/boss.js';
import { LAP, LEVELS, WONDERS } from './sim/maps.js';
import { stageOfContent } from './sim/sequence.js';

const bigBeaten = (s) => (s.beaten ?? []).filter((k) => BOSS_KINDS.includes(k)).length;
const mapBeaten = (s) => (s.beaten ?? []).filter((k) => !BOSS_KINDS.includes(k)).length;
const allBeaten = (s) => (s.beaten ?? []).length;
const stagesCleared = (s) => (s.cleared ? s.stage + 1 : Math.max(0, s.stage)); // stages cleared so far, as a run reports them
// The stage (index) each chapter of the first lap ends on: 25, 38 and 65 (stages 26, 39, 66).
const CHAPTER_END = Object.freeze({
  landmarks: stageOfContent(LEVELS.length - 1),
  wonders: stageOfContent(LEVELS.length + WONDERS.length - 1),
  play: stageOfContent(LAP.length - 1),
});
/** @returns {number} stage index of the last map of the first lap (the 60 maps) */
export const lapEndStage = () => CHAPTER_END.play;
const stageGoal = (n) => ({ test: (s) => s.cleared && s.stage + 1 >= n, progress: (s) => [Math.min(n, stagesCleared(s)), n] });
const countGoal = (count, n) => ({ test: (s) => count(s) >= n, progress: (s) => [Math.min(n, count(s)), n] });

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
  { id: 'stage_20', icon: '🥉', name: '20 스테이지', desc: '스테이지 20 클리어', gold: 150, ...stageGoal(20) },
  { id: 'stage_50', icon: '🥈', name: '50 스테이지', desc: '스테이지 50 클리어', gold: 300, ...stageGoal(50) },
  { id: 'stage_100', icon: '🥇', name: '100 스테이지', desc: '스테이지 100 클리어', gold: 500, ...stageGoal(100) },
  // The mid game: bosses, the chapters and one trip round the world, stars and coming back daily.
  { id: 'boss_big_1', icon: '🗿', name: '거인 사냥', desc: '대형 보스 처음 격파', gold: 100, test: (s) => bigBeaten(s) >= 1 },
  { id: 'boss_big_4', icon: '🏆', name: '4대 보스 정복', desc: '대형 보스 4종 모두 격파', gold: 500, ...countGoal(bigBeaten, BOSS_KINDS.length) },
  { id: 'boss_map_10', icon: '🐉', name: '보스 사냥꾼', desc: '서로 다른 맵 보스 10종 격파', gold: 200, ...countGoal(mapBeaten, 10) },
  { id: 'dex_20', icon: '👾', name: '도감 절반', desc: '보스 20종 격파 (도감)', gold: 200, ...countGoal(allBeaten, 20) },
  { id: 'dex_40', icon: '👑', name: '도감 완성', desc: '보스 40종 모두 격파', gold: 500, ...countGoal(allBeaten, 40) },
  { id: 'chapter_landmarks', icon: '📷', name: '랜드마크 완주', desc: `세계 랜드마크 ${LEVELS.length}곳 완주 (${CHAPTER_END.landmarks + 1}판)`, gold: 100, ...stageGoal(CHAPTER_END.landmarks + 1) },
  { id: 'chapter_wonders', icon: '✨', name: '경이 완주', desc: `경이의 세계 ${WONDERS.length}곳 완주 (${CHAPTER_END.wonders + 1}판)`, gold: 150, ...stageGoal(CHAPTER_END.wonders + 1) },
  { id: 'chapter_play', icon: '🏁', name: '놀이 완주', desc: `놀이 세계 ${LAP.length - LEVELS.length - WONDERS.length}곳 완주 (${CHAPTER_END.play + 1}판)`, gold: 200, ...stageGoal(CHAPTER_END.play + 1) },
  { id: 'lap_one', icon: '🌍', name: '세계 일주', desc: `${LAP.length}개 맵 한 바퀴 (${CHAPTER_END.play + 1}판) 클리어`, gold: 300, ...stageGoal(CHAPTER_END.play + 1) },
  { id: 'stars_30', icon: '⭐', name: '별 30개', desc: '별 30개 모으기', gold: 100, ...countGoal((s) => s.totalStars ?? 0, 30) },
  { id: 'stars_90', icon: '🌟', name: '별 90개', desc: '별 90개 모으기', gold: 300, ...countGoal((s) => s.totalStars ?? 0, 90) },
  { id: 'streak_7', icon: '📅', name: '개근', desc: '7일 연속 클리어', gold: 300, ...countGoal((s) => s.streak ?? 0, 7) },
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
