// Sizing for the generated boss models: kept free of three.js so it can be tested.

/**
 * Scale that makes the wider side of a model (as seen by the camera) span the boss's width.
 * @param {{ x:number, y:number }} size model extent on screen axes after orienting
 * @param {number} r boss radius in board cells
 * @returns {number}
 */
export function fitScale(size, r) {
  const wide = Math.max(size.x, size.y);
  return Number.isFinite(wide) && wide > 0 ? (2 * r) / wide : 1;
}
