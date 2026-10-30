// The collection screens (boss dex, travel album) built from what the save already
// keeps: bosses beaten (and where), best stars and best scores per stage. Pure data;
// collectionView.js draws it.

import { BOSSES, LAP, LEVELS, WONDERS, PLAY, BOSS_PREFIX } from './sim/maps.js';
import { MAP_BOSSES } from './sim/mapBosses.js';
import { stageOfContent } from './sim/sequence.js';

const LAPS_SHOWN = 3; // plain, sunset and night: the laps that look different

/**
 * The 40 bosses in dex order: the big four, then each map boss once (놀이 세계 reuses earlier ones).
 * @returns {{ kind:string, name:string, big:boolean, beaten:boolean, metAt:number|null }[]} metAt: stage index first beaten on
 */
export function bossDex(save) {
  const beaten = new Set(save.beaten ?? []);
  const at = save.beatenAt ?? {};
  const big = BOSSES.map((b) => ({ kind: b.id, name: b.name.replace(BOSS_PREFIX, ''), big: true }));
  const seen = new Set(big.map((b) => b.kind));
  const maps = [];
  for (const m of Object.values(MAP_BOSSES)) {
    if (seen.has(m.kind)) continue;
    seen.add(m.kind);
    maps.push({ kind: m.kind, name: m.name, big: false });
  }
  return [...big, ...maps].map((e) => ({ ...e, beaten: beaten.has(e.kind), metAt: Number.isInteger(at[e.kind]) ? at[e.kind] : null }));
}

/** @param {number} k index within the lap @returns {0|1|2} its chapter: landmarks, wonders, play */
const chapterOf = (k) => (k < LEVELS.length ? 0 : k < LEVELS.length + WONDERS.length ? 1 : 2);

/**
 * One card per map of the lap: cleared on any lap, the best stars across laps, and whether the
 * sunset (lap 2) and night (lap 3) versions were cleared.
 * @returns {{ id:string, name:string, photo:string|null, palette:string[], chapter:number, cleared:boolean,
 *   bestStars:number, stamps:{ sunset:boolean, night:boolean } }[]}
 */
export function travelAlbum(save) {
  const stars = save.stars ?? {};
  const best = save.best ?? {};
  return LAP.map((m, k) => {
    const stages = Array.from({ length: LAPS_SHOWN }, (_, lap) => stageOfContent(k + lap * LAP.length));
    const cleared = stages.map((n) => (best[n] ?? 0) > 0);
    return {
      id: m.id,
      name: m.name,
      photo: m.photo === null ? null : m.id,
      palette: m.palette,
      chapter: chapterOf(k),
      cleared: cleared.some(Boolean),
      bestStars: Math.max(0, ...stages.map((n) => stars[n] ?? 0)),
      stamps: { sunset: cleared[1], night: cleared[2] },
    };
  });
}

/** Totals for the title button and the chapter progress bars. */
export function collectionCounts(save) {
  const dex = bossDex(save);
  const album = travelAlbum(save);
  const chapters = [['세계 랜드마크', LEVELS.length], ['경이의 세계', WONDERS.length], ['놀이 세계', PLAY.length]]
    .map(([name, total], c) => ({ name, total, have: album.filter((m) => m.chapter === c && m.cleared).length }));
  return {
    bosses: { have: dex.filter((e) => e.beaten).length, total: dex.length },
    maps: { have: album.filter((m) => m.cleared).length, total: album.length },
    chapters,
  };
}
