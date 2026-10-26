import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { soundForButton, UI_SOUNDS } from '../src/uiSounds.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const buttonIds = [...html.matchAll(/<button[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);

describe('button sounds', () => {
  it('finds the buttons in the page', () => {
    expect(buttonIds.length).toBeGreaterThan(15);
  });

  it('every button in the page is given its sound on purpose (listed, even if silent)', () => {
    for (const id of buttonIds) expect(id in UI_SOUNDS, id).toBe(true);
  });

  it('every listed sound is a real one or deliberately silent', () => {
    const known = new Set(['tap', 'confirm', 'back', 'open', 'toggle', 'pause', 'resume']);
    for (const [id, name] of Object.entries(UI_SOUNDS)) expect(name === null || known.has(name), id).toBe(true);
  });

  it('going back sounds different from going forward', () => {
    expect(UI_SOUNDS['btn-menu']).toBe('back');
    expect(UI_SOUNDS['btn-next']).toBe('confirm');
  });

  it('skill buttons stay silent here (the game already plays the skill sound)', () => {
    expect(soundForButton({ id: 'skill-split', classList: { contains: () => false } })).toBeNull();
  });

  it('stage tiles (no id) tap like any other button', () => {
    expect(soundForButton({ id: '', classList: { contains: (c) => c === 'stage-btn' } })).toBe('confirm');
    expect(soundForButton({ id: '', classList: { contains: () => false } })).toBe('tap');
  });
});
