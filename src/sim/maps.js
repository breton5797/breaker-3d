// Landmark stages: ancient sites, ruins and world-famous places, each a brick
// mural with its own palette (a/b sky, c ground, d-h the landmark). Ordered
// from open murals to ones braced with more steel.
import { COLS, toLines } from './mapkit.js';
import {
  giza, stonehenge, moai, parthenon, sphinx, colosseum, chichenItza, angkorWat, petra, machuPicchu, greatWall,
} from './landmarks/ancient.js';
import {
  fuji, liberty, eiffel, pisa, tajMahal, bigBen, sungnyemun, nSeoulTower, operaHouse, goldenGate, stBasil,
  forbiddenCity, sagradaFamilia,
} from './landmarks/famous.js';

export { COLS, toLines };

const map = (name, subtitle, build, palette) => Object.freeze({ name, subtitle, build, palette: Object.freeze(palette) });

export const LEVELS = Object.freeze([
  map('기자 피라미드', '이집트 · 기원전 26세기', giza,
    ['#7ec8f0', '#bfe3f2', '#e9c46a', '#e8b86a', '#ffcf3a', '#c8914a', '#b07a3c', '#d9a55b']),
  map('후지산', '일본 · 해발 3,776m', fuji,
    ['#8fc9f2', '#f6c7d4', '#2f7d4f', '#5b6fa8', '#e2453c', '#f4f7fb', '#40538a', '#3a8fd1']),
  map('스톤헨지', '영국 · 기원전 3000년경', stonehenge,
    ['#7b6fd6', '#ff9e6d', '#5fa548', '#9aa0a8', '#ffd166', '#6c727c', '#4a4f57', '#3f7d3a']),
  map('모아이', '칠레 · 라파누이(이스터섬)', moai,
    ['#5dc1f0', '#a8e0f5', '#6fbf4e', '#7d746c', '#9a9087', '#4b443e', '#1f8fd1', '#c0473a']),
  map('자유의 여신상', '미국 뉴욕 · 1886년', liberty,
    ['#78b9ee', '#bcd9f2', '#8c96b0', '#5fb3a1', '#c9b79c', '#ffd23f', '#2b6cb0', '#6b7a99']),
  map('에펠탑', '프랑스 파리 · 1889년', eiffel,
    ['#8ec5f5', '#cfe6fb', '#5daa4f', '#8b5e3c', '#b07a4f', '#3d3d3d', '#5d4030', '#cccccc']),
  map('피사의 사탑', '이탈리아 피사 · 1173년 착공', pisa,
    ['#7fc4f0', '#c4e4f7', '#62b04f', '#f2ead8', '#d9ccb0', '#a89c84', '#8a5a44', '#e0d6c0']),
  map('타지마할', '인도 아그라 · 17세기', tajMahal,
    ['#f7b4a7', '#fbd9c4', '#4f9a4a', '#f7f4ee', '#e3d9c8', '#b9aa94', '#5aa9e6', '#d6b04a']),
  map('파르테논 신전', '그리스 아테네 · 기원전 5세기', parthenon,
    ['#6fb8f0', '#b3dcf7', '#b9a27d', '#ece4d2', '#d8ccb2', '#b4a685', '#8f8166', '#7d9a52']),
  map('빅벤', '영국 런던 · 1859년', bigBen,
    ['#3a4a8c', '#e98a5c', '#6d7891', '#c9a86a', '#a88a55', '#5a4a35', '#2f5d8a', '#f4efe3']),
  map('숭례문', '한국 서울 · 1398년', sungnyemun,
    ['#7ec3ee', '#c3e2f5', '#a7a196', '#b8322c', '#cfc8bb', '#4c5a52', '#2b2f33', '#3e8f6b']),
  map('N서울타워', '한국 서울 남산 · 1975년', nSeoulTower,
    ['#16204a', '#26346b', '#2f6b45', '#e8ecf5', '#ffd166', '#9aa6c4', '#3a3f5c', '#cfd8ff']),
  map('시드니 오페라하우스', '호주 시드니 · 1973년', operaHouse,
    ['#69b8f2', '#b9def7', '#8a8f99', '#f7f7f2', '#d9c3a3', '#cfd3d6', '#2a7fc9', '#6c8f5a']),
  map('금문교', '미국 샌프란시스코 · 1937년', goldenGate,
    ['#9fb7c9', '#dfe7ec', '#7a8f5a', '#c0362c', '#e6e6e6', '#8a241d', '#2c6a8f', '#555b66']),
  map('성 바실리 대성당', '러시아 모스크바 · 1561년', stBasil,
    ['#7cc3f0', '#bfe1f5', '#a03c32', '#e2453c', '#c96a4a', '#2e8b57', '#2b6cb0', '#ffd23f']),
  map('콜로세움', '이탈리아 로마 · 80년', colosseum,
    ['#7ec8f0', '#c2e5f7', '#b7a57a', '#d8c39a', '#c2ab7f', '#8c7650', '#a08a60', '#6a8f4a']),
  map('스핑크스', '이집트 기자 · 기원전 26세기', sphinx,
    ['#79c2ef', '#c8e6f5', '#e7c483', '#e2b66d', '#a97d42', '#c09050', '#d8ac68', '#3f6fa8']),
  map('치첸이트사', '멕시코 · 마야 문명', chichenItza,
    ['#6cbdf0', '#b6e0f6', '#2f8a4a', '#cdbf9e', '#b8a882', '#e3d7bb', '#8e8166', '#1f6b3a']),
  map('앙코르와트', '캄보디아 · 12세기', angkorWat,
    ['#f59e7a', '#fbc98a', '#6b6458', '#7b7468', '#9c9284', '#5c564c', '#4a7fa8', '#3a5f80']),
  map('자금성', '중국 베이징 · 1420년', forbiddenCity,
    ['#7ec3ee', '#c9e5f6', '#2e8b57', '#b8322c', '#efeae0', '#8a2420', '#f2b705', '#b9b2a6']),
  map('페트라', '요르단 · 나바테아 왕국', petra,
    ['#8fd0f5', '#e6c79a', '#c97b5a', '#e09b78', '#f0b392', '#9e5a40', '#5a2e22', '#b06a4c']),
  map('마추픽추', '페루 · 15세기 잉카', machuPicchu,
    ['#8ec9f2', '#f2f5f8', '#2f7d4f', '#9a9488', '#8c8478', '#c4a35a', '#5fae4e', '#6b7c8a']),
  map('만리장성', '중국 · 기원전 7세기~17세기', greatWall,
    ['#7fc4f0', '#c7e4f6', '#3f8f4a', '#9b8f7a', '#b8ad96', '#857862', '#3d3428', '#7aa8c9']),
  map('사그라다 파밀리아', '스페인 바르셀로나 · 1882년 착공', sagradaFamilia,
    ['#79c1ef', '#c6e3f6', '#9a8f7a', '#d9c7a1', '#c4b08a', '#9c8a66', '#4a4036', '#5f646e']),
]);

/** Mixes hex colour `a` toward `b` by t (0..1). */
export function tint(a, b, t) {
  const ch = (hex, k) => parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16);
  const mix = (k) => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * t).toString(16).padStart(2, '0');
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

// Each lap of the landmark list comes back at another time of day.
const VARIANTS = [
  null,
  { suffix: ' · 노을', sky: ['#ff8a5c', '#ffc27a'], toward: '#ff7a3c', t: 0.22 },
  { suffix: ' · 밤', sky: ['#1c2756', '#2e3c78'], toward: '#0b1238', t: 0.4 },
];

/** @returns {{ name:string, subtitle:string, palette:string[], build:() => string[] }} landmark for stage n */
export function landmarkAt(n) {
  const base = LEVELS[n % LEVELS.length];
  const v = VARIANTS[Math.floor(n / LEVELS.length) % VARIANTS.length];
  if (!v) return base;
  const palette = base.palette.map((hex, k) => (k < 2 ? tint(hex, v.sky[k], 0.75) : tint(hex, v.toward, v.t)));
  return { ...base, name: base.name + v.suffix, palette };
}
