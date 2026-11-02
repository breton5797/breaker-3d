import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TALL_REACH } from '../src/render/environment.js';

// No empty bands on portrait screens (owner, 2026-11-02; docs/plans/2026-11-02-size-fullscreen-pipes, B1):
// the table runs on under the HUD and the skill buttons, and the skill band is one row high.
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('table apron on tall screens', () => {
  it('tall screens get a slab that runs well past both ends of the board', () => {
    expect(TALL_REACH).toBeGreaterThanOrEqual(40);
    expect(read('../src/render/stage.js')).toMatch(/room\.setTall\(w < h\)/);
    expect(read('../src/render/environment.js')).toMatch(/function setTall\(tall\)/);
  });

  it('the skill band is one row of buttons: 96px, and the buttons sit side by side in portrait', () => {
    expect(read('../src/render/stage.js')).toMatch(/const SKILLS_PX = 96;/);
    const css = read('../src/style.css');
    expect(css).toMatch(/@media \(orientation: portrait\) \{ #skills \{ flex-direction: row; \} \}/);
    const size = Number(css.match(/\.skill \{[^}]*height: (\d+)px/)[1]);
    expect(size).toBeGreaterThanOrEqual(44); // a comfortable touch target
    expect(size + 16).toBeLessThanOrEqual(96); // button + its 16px gap from the screen edge fit the band
  });
});
