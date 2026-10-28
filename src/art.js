import { MAP_BOSSES } from './sim/mapBosses.js';

// Generated artwork shipped in public/art (made locally with Z-Image-Turbo,
// Apache-2.0; see CREDITS.md). Every picture is optional: the game draws a
// simple fallback until it loads, or if it never does.

export const ART = Object.freeze({
  brick: 'tex/brick.jpg', // light grey surface, tinted per brick
  board: 'tex/board.jpg', // table inside the rails
  concrete: 'tex/concrete.jpg', // room floor around the board
  steel: 'tex/steel.jpg', // boss armour plates
  bomb: 'icon/bomb.png',
  fire: 'icon/fire.png',
  star: 'icon/star.png',
  colossus: 'skin/colossus.jpg',
  kraken: 'skin/kraken.jpg',
  golem: 'skin/golem.jpg',
  mothership: 'skin/mothership.jpg',
});

// Boss bodies: textured 3D models made with Ludo.ai (image to 3D), compressed
// with glTF-Transform. Loaded only when a boss appears; the simple-shape boss
// stands in until then. The big four, then one per map boss (same file name as its kind).
export const BOSS_MODELS = Object.freeze({
  colossus: 'model/colossus.glb',
  kraken: 'model/kraken.glb',
  golem: 'model/golem.glb',
  mothership: 'model/mothership.glb',
  ...Object.fromEntries(Object.values(MAP_BOSSES).map(({ kind }) => [kind, `model/${kind}.glb`])),
});

// Bump when any picture is redrawn under the same name: the offline cache
// keys by URL, so a new version makes returning players fetch the new art.
const ART_VERSION = 1;

/** @param {string} kind a boss kind @returns {string} its portrait (Higgsfield, see CREDITS.md) */
export const bossArt = (kind) => `boss/${kind}.webp`;

/** @param {string} id a fruit id from src/fruits.js */
export const fruitArt = (id) => `fruit/${id}.png`;

/** @param {string} path a path inside public/art */
export const artUrl = (path) => `${import.meta.env.BASE_URL}art/${path}?v=${ART_VERSION}`;
