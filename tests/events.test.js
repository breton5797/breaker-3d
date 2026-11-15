import { describe, it, expect } from 'vitest';
import {
  weekOf, dailyMissions, weeklyChallenge, track, claimMission, claimAllBonus, claimWeekly, eventsStatus, cleanEvents, tallyEvents, stageCounts,
  MISSION_GOLD, ALL_DONE_GOLD, WEEKLY_GOLD, METRICS,
} from '../src/events.js';

// Daily missions and a weekly challenge (owner, 2026-11-16: "매일, 매주 이벤트로 재방문율 고도화").
// GAME_PSYCHOLOGY P1-P4: rewards are fixed gold / stamps, nothing random, nothing paid, nothing lost
// for a missed day. Missions are picked by the date alone (the same for everyone on that day).
const base = (over = {}) => ({ unlocked: 30, gold: 0, ...over });
const DAY = '2026-11-18'; // a Wednesday
const total = (m) => m.reduce((s, x) => s + x.gold, 0);

describe('counting play', () => {
  it('fruit caught, skills used and (on a pipe stage) getting in past the pipe', () => {
    const evs = [{ t: 'collect' }, { t: 'collect' }, { t: 'skill' }, { t: 'enter' }, { t: 'break' }];
    expect(tallyEvents({}, evs, true)).toEqual({ fruit: 2, skill: 1, pipe: 1 });
    expect(tallyEvents({ fruit: 3 }, evs, false)).toEqual({ fruit: 5, skill: 1 }); // no pipe on this stage
    expect(tallyEvents({ fruit: 1 }, [], true)).toEqual({ fruit: 1 });
  });

  it('a finished stage adds clears, bosses, coins and three-star clears', () => {
    expect(stageCounts({ fruit: 2 }, { won: true, boss: true, coins: 37, stars: 3 })).toEqual({ fruit: 2, clear: 1, boss: 1, coin: 37, stars3: 1 });
    expect(stageCounts({}, { won: false, boss: false, coins: 5, stars: 0 })).toEqual({ coin: 5 });
  });
});

describe('calendar', () => {
  it('a week starts on Monday (local date), across a year end too', () => {
    expect(weekOf('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(weekOf('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(weekOf('2026-11-23')).toBe('2026-11-23'); // next Monday
    expect(weekOf('2026-12-31')).toBe('2026-12-28');
    expect(weekOf('2027-01-01')).toBe('2026-12-28');
    expect(weekOf('2027-01-04')).toBe('2027-01-04');
  });
});

describe('daily missions', () => {
  it('three a day, easy / normal / hard, fixed rewards, the same all day', () => {
    const m = dailyMissions(DAY, 30);
    expect(m.map((x) => x.tier)).toEqual(['easy', 'normal', 'hard']);
    expect(m.map((x) => x.gold)).toEqual(MISSION_GOLD);
    expect(dailyMissions(DAY, 30)).toEqual(m);
    for (const x of m) { expect(METRICS).toContain(x.metric); expect(x.goal).toBeGreaterThan(0); }
    expect(new Set(m.map((x) => x.metric)).size).toBe(3); // three different things to do
    expect(total(m) + ALL_DONE_GOLD).toBe(400); // the owner-approved daily total
  });

  it('change from day to day', () => {
    const days = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
    const sets = new Set(days.map((d) => dailyMissions(d, 30).map((x) => `${x.metric}${x.goal}`).join()));
    expect(sets.size).toBeGreaterThanOrEqual(5);
  });

  it('never ask a player for a pipe before stage 10 opens', () => {
    for (let k = 0; k < 60; k++) {
      const d = `2026-12-${String((k % 28) + 1).padStart(2, '0')}`;
      expect(dailyMissions(d, 3).some((x) => x.metric === 'pipe')).toBe(false);
    }
  });
});

describe('weekly challenge', () => {
  it('three tiers of one goal, fixed rewards, the same all week', () => {
    const w = weeklyChallenge('2026-11-18');
    expect(w.week).toBe('2026-11-16');
    expect(w.goals).toHaveLength(3);
    expect(w.goals[0]).toBeLessThan(w.goals[1]);
    expect(w.goals[1]).toBeLessThan(w.goals[2]);
    expect(w.gold).toEqual(WEEKLY_GOLD);
    expect(WEEKLY_GOLD).toEqual([200, 400, 800]);
    expect(weeklyChallenge('2026-11-22')).toEqual(w);
    expect(weeklyChallenge('2026-11-23').week).toBe('2026-11-23');
  });

  it('rotates what it asks for week to week', () => {
    const metrics = new Set(['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07'].map((d) => weeklyChallenge(d).metric));
    expect(metrics.size).toBe(4);
  });
});

describe('progress and rewards', () => {
  const missions = dailyMissions(DAY, 30);
  const first = missions[0];

  it('tracks progress; a mission pays once, only when done, by tapping claim', () => {
    let s = track(base(), DAY, { [first.metric]: first.goal - 1 });
    expect(claimMission(s, DAY, 0).gold).toBe(0);
    s = track(s, DAY, { [first.metric]: 1 });
    const c = claimMission(s, DAY, 0);
    expect(c.gold).toBe(first.gold);
    expect(c.save.gold).toBe(first.gold);
    expect(claimMission(c.save, DAY, 0).gold).toBe(0); // only once
  });

  it('the all-done bonus pays once after all three are claimed', () => {
    let s = track(base(), DAY, Object.fromEntries(missions.map((m) => [m.metric, m.goal])));
    expect(claimAllBonus(s, DAY).gold).toBe(0);
    for (let i = 0; i < 3; i++) s = claimMission(s, DAY, i).save;
    const b = claimAllBonus(s, DAY);
    expect(b.gold).toBe(ALL_DONE_GOLD);
    expect(claimAllBonus(b.save, DAY).gold).toBe(0);
    expect(b.save.gold).toBe(400);
  });

  it('a new day starts fresh, with no penalty for days missed', () => {
    let s = track(base(), DAY, { [first.metric]: first.goal });
    s = claimMission(s, DAY, 0).save;
    const later = '2026-11-25';
    const st = eventsStatus(s, later);
    expect(st.missions.every((m) => m.progress === 0 && !m.claimed)).toBe(true);
    expect(s.gold).toBe(first.gold); // gold already earned stays
  });

  it('a clock turned back cannot claim a day twice', () => {
    let s = track(base(), DAY, { [first.metric]: first.goal });
    s = claimMission(s, DAY, 0).save;
    expect(claimMission(track(s, '2026-11-17', { [first.metric]: 99 }), '2026-11-17', 0).gold).toBe(0);
  });

  it('weekly tiers pay in order, once each; the third adds the week stamp', () => {
    const w = weeklyChallenge(DAY);
    let s = track(base(), DAY, { [w.metric]: w.goals[2] });
    expect(claimWeekly(s, DAY, 1).gold).toBe(0); // tier 1 first
    for (let k = 0; k < 3; k++) {
      const c = claimWeekly(s, DAY, k);
      expect(c.gold).toBe(WEEKLY_GOLD[k]);
      s = c.save;
    }
    expect(s.events.stamps).toEqual(['2026-11-16']);
    expect(claimWeekly(s, DAY, 2).gold).toBe(0);
    expect(eventsStatus(s, '2026-11-24').weekly.claimed).toEqual([false, false, false]); // next week anew
    expect(eventsStatus(s, '2026-11-24').stamps).toEqual(['2026-11-16']); // stamps stay forever
  });

  it('the status says what can be claimed, for the title button', () => {
    const s = track(base(), DAY, { [first.metric]: first.goal });
    const st = eventsStatus(s, DAY);
    expect(st.claimable).toBe(1);
    expect(st.done).toBe(1);
    expect(st.missions).toHaveLength(3);
  });

  it('ignores bad input (negative, unknown metric, non-numbers)', () => {
    const s = track(base(), DAY, { fruit: -5, nope: 3, clear: 'x' });
    expect(eventsStatus(s, DAY).missions.every((m) => m.progress === 0)).toBe(true);
  });

  it('a saved state is checked on load: good one kept, edited or broken ones dropped', () => {
    let s = track(base(), DAY, { [first.metric]: first.goal });
    s = claimMission(s, DAY, 0).save;
    const json = JSON.parse(JSON.stringify(s.events));
    expect(cleanEvents(json, DAY)).toEqual(s.events);
    const inflated = { ...json, missions: json.missions.map((m) => ({ ...m, gold: 99999 })) };
    expect(cleanEvents(inflated, DAY).day).toBe(''); // a mission that is not the day's own: day starts over
    expect(cleanEvents({ ...json, day: '2099-01-01' }, DAY).day).toBe(''); // far-future clock: no lock
    expect(cleanEvents({ ...json, dp: { fruit: -3, nope: 2, clear: 'x' } }, DAY).dp).toEqual({});
    expect(cleanEvents({ ...json, stamps: ['2026-11-16', 'x', '2026-11-16'] }, DAY).stamps).toEqual(['2026-11-16']);
    expect(cleanEvents('garbage', DAY)).toEqual(cleanEvents(undefined, DAY));
  });

  it('never mutates the save it is given', () => {
    const s = Object.freeze(base());
    expect(() => track(s, DAY, { clear: 1 })).not.toThrow();
  });
});
