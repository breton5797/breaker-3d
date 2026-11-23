import { describe, it, expect, vi } from 'vitest';
import { backAction, safeAreaVars, startToss } from '../src/toss.js';

// The Apps in Toss build (owner, 2026-11-23): the system back button must always lead somewhere
// and the game must stay inside the safe area (Toss game checklist).
describe('Toss back button', () => {
  it('closes what is on top first, pauses play, and only leaves the mini-app from the bare title', () => {
    expect(backAction({ mode: 'play', picking: true, subscreen: false })).toBe('closePicker');
    expect(backAction({ mode: 'play', picking: false, subscreen: false })).toBe('pause');
    expect(backAction({ mode: 'paused', picking: false, subscreen: false })).toBe('pause'); // resumes
    expect(backAction({ mode: 'outro', picking: false, subscreen: false })).toBe('menu');
    expect(backAction({ mode: 'title', picking: false, subscreen: true })).toBe('closeSubscreen');
    expect(backAction({ mode: 'title', picking: false, subscreen: false })).toBe('exit');
  });
});

describe('Toss safe area', () => {
  it('turns the insets into CSS variables (0 when missing or bad)', () => {
    expect(safeAreaVars({ top: 47, bottom: 34, left: 0, right: 0 })).toEqual({ '--safe-top': '47px', '--safe-bottom': '34px' });
    expect(safeAreaVars(null)).toEqual({ '--safe-top': '0px', '--safe-bottom': '0px' });
    expect(safeAreaVars({ top: -5, bottom: 'x' })).toEqual({ '--safe-top': '0px', '--safe-bottom': '0px' });
  });

  it('start-up sets the insets and routes the back event; exit closes the view', async () => {
    let onBack;
    const sdk = {
      SafeArea: { get: () => ({ top: 20, bottom: 10 }) },
      graniteEvent: { addEventListener: vi.fn((name, { onEvent }) => { if (name === 'backEvent') onBack = onEvent; return () => {}; }) },
      closeView: vi.fn(async () => {}),
    };
    const style = { setProperty: vi.fn() };
    const handlers = { closePicker: vi.fn(), pause: vi.fn(), menu: vi.fn(), closeSubscreen: vi.fn() };
    let state = { mode: 'play', picking: false, subscreen: false };
    await startToss(async () => sdk, { style, state: () => state, ...handlers });
    expect(style.setProperty).toHaveBeenCalledWith('--safe-top', '20px');
    onBack();
    expect(handlers.pause).toHaveBeenCalledOnce();
    state = { mode: 'title', picking: false, subscreen: false };
    onBack();
    expect(sdk.closeView).toHaveBeenCalledOnce();
  });

  it('a missing SDK piece never breaks the game', async () => {
    await expect(startToss(async () => ({}), { style: { setProperty() {} }, state: () => ({ mode: 'title' }) })).resolves.toBeUndefined();
    await expect(startToss(async () => { throw new Error('no sdk'); }, { style: { setProperty() {} }, state: () => ({}) })).resolves.toBeUndefined();
  });
});
