// Draws the daily missions and the weekly challenge (events.js) into the events panel, and words
// the title button. eventRows is the data (tested); renderEvents only turns it into DOM.

import { t } from './i18n.js';

/** @param {string} metric @param {number} n */
export const missionLabel = (metric, n) => t(`mission.${metric}`, { n });

/** The title button: today's missions done, this week's tier, and anything waiting to be claimed. */
export function eventsButtonText(st) {
  return t('title.events', { done: st.done, tier: st.weeklyTier }) + (st.claimable ? t('title.eventsReady', { n: st.claimable }) : '');
}

/**
 * The panel's rows in order: three missions, the all-done bonus, three weekly tiers.
 * claim is what a tap pays now ({ kind, i, gold }) or null.
 * @param {ReturnType<import('./events.js').eventsStatus>} st
 */
export function eventRows(st) {
  const missions = st.missions.map((m, i) => ({
    kind: 'mission', icon: '🎯', label: missionLabel(m.metric, m.goal), detail: `${m.progress}/${m.goal}`,
    claimed: m.claimed, claim: m.done && !m.claimed ? { kind: 'mission', i, gold: m.gold } : null, gold: m.gold,
  }));
  const bonus = {
    kind: 'bonus', icon: '🎁', label: t('events.bonus'), detail: `${st.missions.filter((m) => m.claimed).length}/3`,
    claimed: st.bonus.claimed, claim: st.bonus.ready ? { kind: 'bonus', i: 0, gold: st.bonus.gold } : null, gold: st.bonus.gold,
  };
  const w = st.weekly;
  const weekly = w.goals.map((goal, k) => ({
    kind: 'weekly', icon: '🏁', label: `${t('events.tier', { k: k + 1 })} · ${missionLabel(w.metric, goal)}`,
    detail: `${Math.min(goal, w.progress)}/${goal}`,
    claimed: w.claimed[k], claim: w.ready[k] ? { kind: 'weekly', i: k, gold: w.gold[k] } : null, gold: w.gold[k],
  }));
  return [...missions, bonus, ...weekly];
}

const el = (tag, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

/**
 * @param {HTMLElement} list the panel's <ul>
 * @param {ReturnType<import('./events.js').eventsStatus>} st
 * @param {{ setRich: (el: HTMLElement, text: string) => void, fmt: (n: number) => string, onClaim: (kind: string, i: number) => void }} io
 */
export function renderEvents(list, st, { setRich, fmt, onClaim }) {
  const head = (key, note) => {
    const li = el('li', 'events-head');
    const b = el('b');
    setRich(b, t(key));
    const small = el('small');
    small.textContent = t(note);
    li.append(b, small);
    return li;
  };
  const row = (r) => {
    const li = el('li', r.claimed ? 'done' : r.claim ? 'ready' : '');
    const icon = el('span', 'icon');
    setRich(icon, r.icon);
    const name = el('b');
    name.textContent = r.label;
    const detail = el('small');
    detail.textContent = r.detail;
    let side;
    if (r.claim) {
      side = el('button', 'primary events-claim');
      setRich(side, t('events.claim', { gold: fmt(r.claim.gold) }));
      side.addEventListener('click', () => onClaim(r.claim.kind, r.claim.i));
    } else {
      side = el('small', 'achv-gold');
      setRich(side, r.claimed ? t('events.claimed') : `+${fmt(r.gold)}🪙`);
    }
    li.append(icon, name, detail, side);
    return li;
  };
  const rows = eventRows(st);
  const stamps = el('li', 'events-head');
  setRich(stamps, t('events.stamps', { n: st.stamps.length }));
  list.replaceChildren(
    head('events.daily', 'events.dailyNote'), ...rows.slice(0, 4).map(row),
    head('events.weekly', 'events.weeklyNote'), ...rows.slice(4).map(row),
    stamps,
  );
}
