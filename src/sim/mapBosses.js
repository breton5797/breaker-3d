// Every map has its own boss, picked to suit the place: a creature from local
// folklore or wildlife, or a machine of the site's material. It roams the sky
// above the mural (or right over it when the mural is tall) and must be beaten
// to clear the stage. These are the mid-size bosses; the big ones still come
// every 10th stage (maps.js BOSSES).
//
// move: path style (boss.js) — sway, eight (figure eight), glide, hop.
// attack: telegraphed blow at the paddle — stomp (wide zone under it), slam
// (a lash down a lane), rock (thrown at the paddle), sweep (a beam across).

import { ATTACK_ZONE, mapAttacks } from './boss.js';

export const MOVES = Object.freeze(['sway', 'eight', 'glide', 'hop']);
export const ATTACKS = Object.freeze(['stomp', 'slam', 'rock', 'sweep']);

const b = (kind, name, move, attack) => Object.freeze({ kind, name, move, attack });

const BASE = Object.freeze({
  // Landmarks
  giza: b('mummy', '미라 파라오', 'sway', 'slam'),
  fuji: b('fireDragon', '화산 불용', 'eight', 'sweep'),
  stonehenge: b('mossStag', '이끼 사슴 정령', 'hop', 'stomp'),
  moai: b('coconutCrab', '거대 야자집게', 'hop', 'slam'),
  liberty: b('copperGolem', '녹청 구리 골렘', 'sway', 'sweep'),
  eiffel: b('ironSpider', '강철 격자 거미', 'eight', 'slam'),
  himeji: b('armoredCrane', '갑옷 백학', 'glide', 'rock'),
  tajMahal: b('marblePeacock', '대리석 공작', 'glide', 'sweep'),
  brandenburgGate: b('bronzeHorse', '청동 군마', 'hop', 'stomp'),
  bigBen: b('clockGolem', '태엽 시계 골렘', 'sway', 'stomp'),
  sungnyemun: b('haetae', '해치', 'hop', 'rock'),
  gyeongbokgung: b('bulgasari', '불가사리', 'sway', 'stomp'),
  grandCanyon: b('scorpion', '거대 사막 전갈', 'hop', 'slam'),
  goldenGate: b('fogSerpent', '안개 바다뱀', 'eight', 'slam'),
  stBasil: b('firebird', '불새', 'glide', 'sweep'),
  charlesBridge: b('clayGolem', '프라하 진흙 골렘', 'sway', 'rock'),
  sphinx: b('scarab', '거대 스카라브', 'hop', 'rock'),
  chichenItza: b('featherSerpent', '비취 깃털뱀', 'eight', 'sweep'),
  angkorWat: b('stoneElephant', '석상 코끼리', 'sway', 'stomp'),
  forbiddenCity: b('jadeLion', '비취 수호 사자', 'hop', 'stomp'),
  petra: b('sandLizard', '붉은 사암 도마뱀', 'eight', 'slam'),
  machuPicchu: b('condor', '거대 콘도르', 'glide', 'rock'),
  greatWall: b('stoneTortoise', '석갑 거북', 'sway', 'rock'),
  sagradaFamilia: b('mosaicSalamander', '모자이크 도롱뇽', 'eight', 'slam'),
  // 경이의 세계
  saturn: b('ringBeast', '고리 소행성 괴수', 'glide', 'rock'),
  curiosity: b('rogueRover', '폭주 탐사 로봇', 'sway', 'sweep'),
  earthrise: b('spaceMoth', '거대 우주 나방', 'glide', 'rock'),
  blackHole: b('voidEye', '공허의 눈', 'glide', 'sweep'),
  dumbo: b('anglerfish', '심해 아귀', 'eight', 'slam'),
  blackSmoker: b('giantIsopod', '거대 등각류', 'sway', 'stomp'),
  jellyfish: b('electricEel', '전기뱀장어', 'eight', 'sweep'),
  spermWhale: b('mosasaur', '모사사우루스', 'eight', 'slam'),
  lavaFountain: b('fireSalamander', '불도롱뇽', 'hop', 'rock'),
  aurora: b('frostBear', '얼음 북극곰', 'hop', 'stomp'),
  supercell: b('thunderEagle', '천둥 독수리', 'glide', 'sweep'),
  iceberg: b('walrus', '거대 바다코끼리', 'sway', 'stomp'),
});

// 놀이 세계 reuses the bosses above (a 3D model each), never the same one twice in the chapter.
const PLAY_REUSE = Object.freeze({
  num1: 'bigBen', num2: 'curiosity', num3: 'liberty', num7: 'charlesBridge', num8: 'saturn', num10: 'blackHole',
  alphaA: 'brandenburgGate', alphaB: 'himeji', alphaC: 'jellyfish', alphaK: 'chichenItza', alphaR: 'sphinx', alphaZ: 'earthrise',
  hangulGa: 'sungnyemun', hangulNa: 'gyeongbokgung', hangulDa: 'stBasil', hangulGong: 'forbiddenCity', hangulByeol: 'greatWall', hangulKkum: 'stonehenge',
  cat: 'supercell', dog: 'aurora', rabbit: 'machuPicchu', panda: 'angkorWat', penguin: 'iceberg', lion: 'grandCanyon',
});

export const MAP_BOSSES = Object.freeze({
  ...BASE,
  ...Object.fromEntries(Object.entries(PLAY_REUSE).map(([id, from]) => [id, BASE[from]])),
});

const BRICK_HP = 0.012; // health per brick on the stage (~40 for an average mural)
const GENTLE_STAGES = 5; // stages 1-5: the boss only roams, it never strikes

/**
 * The fight for a map's boss on stage n (0-based): mid-size, two plates, flying
 * in a band under the box ceiling, tougher as stages rise.
 * @param {string} mapId
 * @param {number} n
 * @param {number} [bricks] bricks on the stage: a bigger mural takes longer to
 *   break, so its boss gets more health to last about as long
 */
export function mapBossSpec(mapId, n, bricks = 3000) {
  const m = MAP_BOSSES[mapId];
  if (!m) return null;
  return {
    kind: m.kind,
    r: 6.5,
    plates: 2,
    band: 18, // rows below the ceiling it may roam, bricks or not
    move: m.move,
    attack: m.attack,
    attackKinds: mapAttacks(m.attack), // its signature blow, then a second one in turn
    zone: ATTACK_ZONE[m.attack],
    attacks: n >= GENTLE_STAGES,
    attackEvery: 7, // a big boss strikes every 4.5 s
    hp: 50 + Math.floor(n * 0.8) + Math.floor(bricks * BRICK_HP),
    dps: 6 + Math.floor(n / 40), // damage it can take per second: once the bricks are gone it falls within ~15 s
    tier: Math.min(10, 1 + Math.floor(n / 30)),
  };
}
