import { COLS, CELL } from '../sim/constants.js';

// The pipe drawn as a trough (owner, 2026-11-07: "강철 블록 모양 → 홈통 모양"). The sim still sees plain
// steel walls (pipes.js); this only says which cells the renderer draws as the trough's rim and which
// as its channel floor. Pipe cell keys are y * 1024 + x (pipes.js); grid cells are y * COLS + x.
const KEY = 1024;

/**
 * @param {{ cells: Uint8Array }} grid the parsed stage (levels.js parseLevel)
 * @param {{ cells: Set<number>, floor: number }|null} pipe the stage's pipe, or null
 * @returns {{ walls: number[], floor: number[] }} grid indices: steel right around the pipe (above the
 *   box floor), and the pipe's open cells above the box floor
 */
export function pipeLook(grid, pipe) {
  if (!pipe) return { walls: [], floor: [] };
  const walls = new Set();
  const floor = [];
  const box = grid.box; // the steel box keeps its own look: only the pipe's own walls become the rim
  const inBox = (x, y) => !box || (x > box.left && x < box.right && y < box.top);
  for (const k of pipe.cells) {
    const x = k % KEY;
    const y = Math.floor(k / KEY);
    if (y <= pipe.floor) continue;
    floor.push(y * COLS + x);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const [nx, ny] = [x + i, y + j];
        if (ny <= pipe.floor || nx < 0 || nx >= COLS || !inBox(nx, ny)) continue;
        const at = ny * COLS + nx;
        if (grid.cells[at] === CELL.STEEL) walls.add(at);
      }
    }
  }
  return { walls: [...walls], floor };
}
