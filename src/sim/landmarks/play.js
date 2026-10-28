// 놀이 세계: big numbers, letters, Hangul and pixel-art animals as brick murals.
// The pictures are generated data (playData.js, scripts/art/play-murals.py);
// here each one gets its bombs, lasers and fire bricks like the other murals.
import { decorate } from '../mapkit.js';
import { PLAY_ART } from './playData.js';

// Glyphs: bombs and lasers in the colour bands, fire in the outline.
const GLYPH_SPECIALS = [['B', 5, 'ef'], ['-', 6, 'g'], ['|', 3, 'f'], ['F', 2, 'h']];
// Animals: the same, spread over the body colours.
const ANIMAL_SPECIALS = [['B', 5, 'ef'], ['-', 6, 'g'], ['|', 3, 'fg'], ['F', 2, 'e']];

/**
 * @param {string} id a key of PLAY_ART
 * @param {number} seed decoration seed (fixed per map, so a stage is the same every time)
 * @param {boolean} animal
 * @returns {() => string[]} the mural builder
 */
export const playMural = (id, seed, animal = false) => () =>
  decorate(PLAY_ART[id].rows.map((row) => [...row]), seed, animal ? ANIMAL_SPECIALS : GLYPH_SPECIALS);

/** @param {string} id @returns {string[]} its palette (a, b sky; c-h the picture) */
export const playPalette = (id) => PLAY_ART[id].palette;
