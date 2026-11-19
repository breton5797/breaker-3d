// Claims from the events panel (daily missions, the all-done bonus, weekly tiers), with the
// rewarded-ad double (owner, 2026-11-19). The player picks the double; the gold is paid only when
// the ad reports the reward as earned, and each claim pays once (events.js), so nothing pays twice.
import { claimMission, claimAllBonus, claimWeekly } from './events.js';

const CLAIMS = { mission: claimMission, bonus: (s, d, _i, mult) => claimAllBonus(s, d, mult), weekly: claimWeekly };

/**
 * @param {{
 *   getSave: () => object, commit: (save: object) => void, via: () => ('ad'|'free'|null),
 *   watchAd: (placement: string) => Promise<boolean>, toast: (key: 'loading'|'failed') => void, today: () => string,
 * }} io commit stores the paid save (persist, coin sound, redraw); via says how a double is offered now
 * @returns {(kind: string, i: number, double?: boolean) => Promise<void>}
 */
export function createEventClaims({ getSave, commit, via, watchAd, toast, today }) {
  let adOnScreen = false; // ignore claim taps until the ad closes
  return async function claim(kind, i, double = false) {
    if (adOnScreen) return;
    let mult = 1;
    if (double) {
      const how = via();
      if (!how) return;
      if (how === 'ad') {
        adOnScreen = true;
        toast('loading');
        const earned = await watchAd('missionDouble').catch(() => false);
        adOnScreen = false;
        if (!earned) { toast('failed'); return; } // the normal claim is still there
      }
      mult = 2;
    }
    const r = CLAIMS[kind]?.(getSave(), today(), i, mult);
    if (r?.gold) commit(r.save);
  };
}
