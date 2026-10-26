// Which rewarded offers to show. Rewards are always the player's choice:
// a revive on game over and double gold on a clear. With "remove ads" bought
// they come free; where there are no ads and no purchase (the web build) they
// are simply not offered.

export const REVIVES_PER_RUN = 1;

/**
 * @param {{ adsAvailable:boolean, adsRemoved:boolean, revivesUsed:number, goldEarned:number, goldDoubled:boolean }} s
 * @returns {{ revive: 'ad'|'free'|null, doubleGold: 'ad'|'free'|null }}
 */
export function rewardOffers({ adsAvailable, adsRemoved, revivesUsed, goldEarned, goldDoubled }) {
  const via = adsRemoved ? 'free' : adsAvailable ? 'ad' : null;
  return {
    revive: revivesUsed < REVIVES_PER_RUN ? via : null,
    doubleGold: goldEarned > 0 && !goldDoubled ? via : null,
  };
}
