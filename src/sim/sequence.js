// Stage order: every 10th stage is a boss; the regular maps run on between
// them without gaps (a boss never takes a map's turn).

export const BOSS_EVERY = 10;

/**
 * @param {number} n stage index (0-based: stage 1 is n = 0)
 * @returns {{ boss:boolean, bossIndex:number, content:number }} content: index of the
 *   regular map to show (counts only non-boss stages); bossIndex: which boss (in turn)
 */
export function stageSlot(n) {
  const bossesSoFar = Math.floor((n + 1) / BOSS_EVERY);
  const boss = (n + 1) % BOSS_EVERY === 0;
  return { boss, bossIndex: boss ? bossesSoFar - 1 : -1, content: n - bossesSoFar };
}
