import { describe, it, expect } from 'vitest';
import { SERVE_START, serveDown, serveMove, serveUp, TAP_PX, CANCEL_PX, REPRESS_MS } from '../src/serveInput.js';
import { AIM_MAX } from '../src/sim/aim.js';

// Two-step touch serve (owner, 2026-11-02; docs/plans/2026-11-02-two-step-serve):
// 1) drag anywhere to place the paddle, lift: no shot; 2) press again, drag sideways to aim, lift: shot.
const W = 400; // screen width in px: half of it turns the aim a full AIM_MAX
const down = (s, x, y, t = 0, id = 1) => serveDown(s, { id, x, y, t });
const move = (s, x, y, id = 1) => serveMove(s, { id, x, y }, W);
const up = (s, x, y, t = 100, id = 1) => serveUp(s, { id, x, y, t });

describe('step 1: place the paddle', () => {
  it('starts in the place step with a straight-up aim', () => {
    expect(SERVE_START.phase).toBe('place');
    expect(SERVE_START.angle).toBe(0);
  });

  it('a drag moves the paddle and lifting never fires; it moves on to the aim step', () => {
    let s = down(SERVE_START, 200, 700);
    const m = move(s, 260, 700);
    expect(m.movePaddle).toBe(true);
    s = m.state;
    const r = up(s, 260, 700, 400);
    expect(r.fire).toBeNull();
    expect(r.state.phase).toBe('aim');
  });

  it('a wobble smaller than a tap does not move the paddle, and a tap goes straight to aiming', () => {
    let s = down(SERVE_START, 200, 700);
    const m = move(s, 200 + TAP_PX - 1, 700);
    expect(m.movePaddle).toBe(false);
    s = m.state;
    const r = up(s, 200 + TAP_PX - 1, 700, 200);
    expect(r.fire).toBeNull();
    expect(r.state.phase).toBe('aim');
  });

  it('once past the tap distance the paddle keeps following, even back near the start', () => {
    let s = move(down(SERVE_START, 200, 700), 240, 700).state;
    expect(move(s, 202, 700).movePaddle).toBe(true);
  });
});

describe('step 2: aim with a sideways drag, lift to fire', () => {
  const aiming = () => up(down(SERVE_START, 200, 700), 200, 700, 50).state; // tapped through step 1 at t=50

  it('a press right after entering the aim step is ignored (no double-tap shot)', () => {
    const s = aiming();
    const early = down(s, 200, 700, 50 + REPRESS_MS - 1);
    expect(early.id).toBeNull();
    const ok = down(s, 200, 700, 50 + REPRESS_MS);
    expect(ok.id).toBe(1);
  });

  it('dragging sideways turns the aim: half the screen width is the full AIM_MAX, clamped', () => {
    const s = down(aiming(), 100, 500, 1000);
    expect(move(s, 100 + W / 4, 500).state.angle).toBeCloseTo(AIM_MAX / 2, 6);
    expect(move(s, 100 - W / 4, 500).state.angle).toBeCloseTo(-AIM_MAX / 2, 6);
    expect(move(s, 100 + W, 500).state.angle).toBeCloseTo(AIM_MAX, 6);
    expect(move(s, 100 + W / 4, 500).movePaddle).toBe(false); // the paddle stays put while aiming
  });

  it('lifting fires at the aimed angle and the next serve starts over at step 1', () => {
    let s = down(aiming(), 100, 500, 1000);
    s = move(s, 100 + W / 4, 500).state;
    const r = up(s, 100 + W / 4, 500, 1400);
    expect(r.fire).toBeCloseTo(AIM_MAX / 2, 6);
    expect(r.state).toEqual(SERVE_START);
  });

  it('a plain tap in the aim step fires straight up', () => {
    const s = down(aiming(), 100, 500, 1000);
    expect(up(s, 100, 500, 1100).fire).toBe(0);
  });

  it('a new press starts from the angle already chosen (fine tuning)', () => {
    let s = down(aiming(), 100, 500, 1000);
    s = move(s, 100 + W / 4, 900).state; // pulled down: cancel
    s = up(s, 100 + W / 4, 900, 1200).state;
    s = down(s, 300, 500, 1600);
    expect(move(s, 300 + W / 8, 500).state.angle).toBeCloseTo((AIM_MAX * 3) / 4, 6);
  });
});

describe('cancel, other fingers', () => {
  const aimingHeld = () => down(up(down(SERVE_START, 200, 700), 200, 700, 50).state, 100, 500, 1000);

  it('pulling the finger down past the cancel distance and lifting does not fire; the angle stays', () => {
    let s = move(aimingHeld(), 150, 500).state;
    const angle = s.angle;
    s = move(s, 150, 500 + CANCEL_PX).state;
    expect(s.cancel).toBe(true);
    const r = up(s, 150, 500 + CANCEL_PX, 1300);
    expect(r.fire).toBeNull();
    expect(r.state.phase).toBe('aim');
    expect(r.state.angle).toBeCloseTo(angle, 6);
  });

  it('coming back up before lifting un-cancels', () => {
    let s = move(aimingHeld(), 150, 500 + CANCEL_PX).state;
    s = move(s, 150, 510).state;
    expect(s.cancel).toBe(false);
    expect(up(s, 150, 510, 1300).fire).not.toBeNull();
  });

  it('a second finger never takes over, moves or fires', () => {
    const s = aimingHeld();
    expect(serveDown(s, { id: 2, x: 0, y: 0, t: 2000 })).toBe(s);
    expect(serveMove(s, { id: 2, x: 300, y: 500 }, W).state).toBe(s);
    expect(serveUp(s, { id: 2, x: 0, y: 0, t: 2100 }).fire).toBeNull();
  });
});
