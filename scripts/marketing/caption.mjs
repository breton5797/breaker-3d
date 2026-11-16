// Captions for the daily gameplay short (daily-short.mjs). Honest copy only: what the clip shows and
// where to get the game, in Korean and English; no invented numbers, rankings or urgency.
import ko from '../../src/locales/ko.js';
import en from '../../src/locales/en.js';

// Stages the demo bot clears inside a minute with thousands of balls (demo-scout.mjs, 2026-11-17).
export const FILMABLE = Object.freeze([12, 8, 20, 3, 14, 2, 9, 11, 18, 21, 22, 10]);

export const LINKS = Object.freeze({
  play: 'https://play.google.com/store/apps/details?id=com.minimalkorea.breaker3d',
  appStore: 'https://apps.apple.com/app/id6829480545',
  web: 'https://breton5797.github.io/breaker-3d/',
});

const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** @param {string} date 'YYYY-MM-DD' @returns {number} the day's stage (1-based) */
export const pickStage = (date) => FILMABLE[dayNumber(date) % FILMABLE.length];

const TAGS = '#BREAKER3D #brickbreaker #벽돌깨기 #mobilegame #모바일게임 #indiegame #casualgame #satisfying #shorts';

/**
 * @param {{ date: string, stage: number, id: string, peak: number, seconds: number }} clip
 * @returns {string} caption.md: Korean, English, links and hashtags, ready to paste
 */
export function shortCaption({ date, stage, id, peak, seconds }) {
  const koName = (ko[`map.${id}.name`] ?? id).replace(/^BOSS · /, '보스 ');
  const enName = (en[`map.${id}.name`] ?? id).replace(/^BOSS · /, 'Boss ');
  const balls = peak.toLocaleString('en-US');
  // The figures are the recorded run's own (daily-short.mjs reads them from the game); no clear, no time.
  const koScene = seconds ? `${koName} 스테이지를 ${seconds}초 만에 깨는 장면` : `${koName} 스테이지 플레이 장면`;
  const enScene = seconds ? `Clearing ${enName} in ${seconds} seconds` : `${enName} gameplay`;
  return [
    `# BREAKER 3D daily short · ${date} · stage ${stage}`,
    '',
    '## 한국어',
    `공 1개로 시작해서 ${balls}개까지! 🍉 ${koScene} (자동 플레이 녹화)`,
    '과일을 받으면 공이 불어나요. 매일 미션·주간 챌린지도 있어요.',
    `▶ Google Play: ${LINKS.play}`,
    `▶ App Store: ${LINKS.appStore}`,
    `▶ 웹에서 바로: ${LINKS.web}`,
    '',
    '## English',
    `One ball to ${balls} balls! 🍉 ${enScene} (auto-play recording)`,
    'Catch fruit to multiply your balls. Daily missions and a weekly challenge too.',
    `▶ Google Play: ${LINKS.play}`,
    `▶ App Store: ${LINKS.appStore}`,
    `▶ Play in your browser: ${LINKS.web}`,
    '',
    '## Hashtags',
    TAGS,
    '',
  ].join('\n');
}
