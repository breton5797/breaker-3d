import { FRUITS } from './fruits.js';
import { ART, fruitArt } from './art.js';

// Clay icons (made with Higgsfield, see CREDITS.md) that stand in for colour emoji,
// which draw differently on every phone. Plain glyphs styled by CSS (★ ☆ ♥ ✓) stay text.
const ui = (name) => `ui/${name}.webp`;

export const ICONS = Object.freeze({
  ...Object.fromEntries(FRUITS.map((f) => [f.emoji, fruitArt(f.id)])),
  '🪙': ui('coin'),
  '⭐': ui('star'),
  '🌟': ui('star_shine'),
  '🔥': ART.fire,
  '🏆': ui('trophy'),
  '🎁': ui('gift'),
  '☄': ui('meteor'),
  '🔊': ui('sound'),
  '🔇': ui('mute'),
  '⏸': ui('pause'),
  '⛶': ui('fullscreen'),
  '📷': ui('camera'),
  '📳': ui('vibe_on'),
  '📴': ui('vibe_off'),
  '📺': ui('tv'),
  '🚫': ui('no_ads'),
  '🎒': ui('backpack'),
  '⚠': ui('warning'),
  '👾': ui('monster'),
  '✨': ui('sparkle'),
  '🌀': ui('vortex'),
  '🌊': ui('wave'),
  '⚡': ui('lightning'),
  '📅': ui('calendar'),
  '🎯': ui('target'),
  '💫': ui('dizzy'),
  '🛡': ui('shield'),
  '🏁': ui('flag'),
  '💖': ui('heart'),
  '⚪': ui('ball'),
  '🌕': ui('ball_pile'),
  '🔗': ui('chain'),
  '🧺': ui('basket'),
  '👑': ui('crown'),
  '🥉': ui('medal_bronze'),
  '🥈': ui('medal_silver'),
  '🥇': ui('medal_gold'),
  '🗿': ui('moai'),
  '🐉': ui('dragon'),
  '🌍': ui('globe'),
});

const VS16 = /️/g;

/** @param {string} emoji @returns {string | undefined} the picture (path inside public/art) for this emoji */
export const iconArt = (emoji) => ICONS[emoji.replace(VS16, '')];

// One emoji (with an optional variation selector) at a time, so text between them survives as is.
const EMOJI = /\p{Extended_Pictographic}️?/gu;

/**
 * @param {string} text
 * @returns {(string | { emoji: string, art: string })[]} text pieces, with each known emoji as its own part
 */
export function splitIcons(text) {
  const parts = [];
  let plain = '';
  let last = 0;
  for (const m of text.matchAll(EMOJI)) {
    const art = iconArt(m[0]);
    if (!art) continue;
    plain += text.slice(last, m.index);
    if (plain) parts.push(plain);
    plain = '';
    parts.push({ emoji: m[0], art });
    last = m.index + m[0].length;
  }
  plain += text.slice(last);
  if (plain) parts.push(plain);
  return parts;
}
