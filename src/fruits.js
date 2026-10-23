// Multiplier items are shown as fruit: the bigger the fruit, the more balls.
export const FRUITS = Object.freeze([
  { mult: 5, emoji: '🍒', name: '체리', color: '#d9304a' },
  { mult: 10, emoji: '🍓', name: '딸기', color: '#ff5470' },
  { mult: 20, emoji: '🍊', name: '오렌지', color: '#ff9a1f' },
  { mult: 30, emoji: '🍎', name: '사과', color: '#e8392c' },
  { mult: 50, emoji: '🍉', name: '수박', color: '#2fb35a' },
  { mult: 100, emoji: '🍍', name: '파인애플', color: '#f2c218' },
]);

const BY_MULT = new Map(FRUITS.map((f) => [f.mult, f]));

/** @param {number} mult */
export const fruitFor = (mult) => BY_MULT.get(mult) ?? FRUITS[0];

export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
