import { describe, it, expect } from 'vitest';
import { eventRows, eventsButtonText, claimActions } from '../src/eventsView.js';
import { t } from '../src/i18n.js';
import { eventsStatus, track, dailyMissions, weeklyChallenge, claimMission } from '../src/events.js';

// The events panel and the title button (owner, 2026-11-16). Korean is the default language.
const DAY = '2026-11-18';
const save = (over = {}) => ({ unlocked: 30, gold: 0, ...over });

describe('events panel rows', () => {
  it('lists the three missions, the all-done bonus, then the three weekly tiers', () => {
    const rows = eventRows(eventsStatus(save(), DAY));
    expect(rows.map((r) => r.kind)).toEqual(['mission', 'mission', 'mission', 'bonus', 'weekly', 'weekly', 'weekly']);
    expect(rows.every((r) => r.claim === null)).toBe(true); // nothing done yet
    expect(rows[0].detail).toMatch(/^0\/\d+$/);
  });

  it('a done mission offers its claim; a claimed one shows as done', () => {
    const m = dailyMissions(DAY, 30)[0];
    let s = track(save(), DAY, { [m.metric]: m.goal });
    let rows = eventRows(eventsStatus(s, DAY));
    expect(rows[0].claim).toEqual({ kind: 'mission', i: 0, gold: m.gold });
    s = claimMission(s, DAY, 0).save;
    rows = eventRows(eventsStatus(s, DAY));
    expect(rows[0].claim).toBeNull();
    expect(rows[0].claimed).toBe(true);
  });

  it('weekly tiers offer claims in order', () => {
    const w = weeklyChallenge(DAY);
    const rows = eventRows(eventsStatus(track(save(), DAY, { [w.metric]: w.goals[2] }), DAY)).filter((r) => r.kind === 'weekly');
    expect(rows.map((r) => r.claim?.i ?? null)).toEqual([0, null, null]);
    expect(rows[2].detail).toBe(`${w.goals[2]}/${w.goals[2]}`);
  });
});

describe('title button', () => {
  it('says how the day and the week stand, and what is waiting to be claimed', () => {
    const m = dailyMissions(DAY, 30)[0];
    expect(eventsButtonText(eventsStatus(save(), DAY))).toBe('🎯 오늘의 미션 0/3 · 이번 주 0/3단계');
    expect(eventsButtonText(eventsStatus(track(save(), DAY, { [m.metric]: m.goal }), DAY))).toBe('🎯 오늘의 미션 1/3 · 이번 주 0/3단계 · 🎁 받을 보상 1개');
  });
});

describe('mission reward x2 (owner, 2026-11-19: rewarded ad doubles a claim, AD_MONETIZATION 4: opt-in only)', () => {
  const claim = { kind: 'mission', i: 0, gold: 50 };
  const fmt = (n) => String(n);

  it('with ads: the normal claim and a "watch an ad" double next to it', () => {
    expect(claimActions(claim, 'ad', fmt)).toEqual([
      { double: false, text: t('events.claim', { gold: '50' }) },
      { double: true, text: t('reward.ad', { label: t('events.double', { gold: '100' }) }) },
    ]);
  });

  it('after "remove ads" the double is free; with no ads (web) only the normal claim', () => {
    expect(claimActions(claim, 'free', fmt)[1]).toEqual({ double: true, text: t('reward.free', { label: t('events.double', { gold: '100' }) }) });
    expect(claimActions(claim, null, fmt)).toEqual([{ double: false, text: t('events.claim', { gold: '50' }) }]);
  });
});
