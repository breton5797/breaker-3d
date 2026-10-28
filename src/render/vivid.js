// Brick colours made brighter and fresher than the maps' own palettes: more
// saturation, darks lifted out of the mud, greys left grey (stone and steel
// must not turn a colour). Applied where bricks are drawn; the maps keep their
// original palettes as the design.

const SATURATE = 1.4; // saturation multiplier for coloured bricks
const SAT_ADD = 0.08;
const GREY = 0.15; // below this saturation a colour counts as grey
const MIN_L = 0.3; // nothing darker than this
const MAX_L = 0.93;

/** @param {string} hex '#rrggbb' @returns {{h:number, s:number, l:number}} h in degrees, s/l 0..1 */
export function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function toHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const ch = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/** Lightness lift: darks rise to at least MIN_L, mids brighten a little, whites stay white. */
const lift = (l) => (l < 0.5 ? MIN_L + l * (0.55 - MIN_L) * 2 : Math.min(MAX_L, 0.55 + (l - 0.5) * 0.9));

/** @param {string} hex '#rrggbb' @returns {string} the brighter, fresher version */
export function vivid(hex) {
  const { h, s, l } = hsl(hex);
  if (s < GREY) return toHex({ h, s, l: lift(l) });
  return toHex({ h, s: Math.min(1, s * SATURATE + SAT_ADD), l: lift(l) });
}
