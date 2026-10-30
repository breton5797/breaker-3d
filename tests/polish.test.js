import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getLevel } from '../src/sim/levels.js';
import { createWorld, launch, useSkill, drainEvents } from '../src/sim/world.js';

// Second audit round (PLAN v38, PR-A): the fixes for what the design and tech
// checks found. Layout and markup are checked at the source, the logic is run.

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = () => read('src/style.css');
const html = () => read('index.html');
const ui = () => read('src/ui.js');
const main = () => read('src/main.js');

/** The text of a function in a source file, from its header to the next top-level function. */
const fnBody = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  expect(at, name).toBeGreaterThan(-1);
  const rest = src.slice(at + 1);
  const end = rest.search(/\n  (?:function |const [A-Z_]+ = |let |\/\*\*)/);
  return rest.slice(0, end < 0 ? undefined : end);
};

describe('offline cache: build files with the same name but another extension are different files', () => {
  it('index-*.js and index-*.css both stay cached (neither prunes the other)', async () => {
    const store = new Map([
      ['https://game.example/breaker-3d/assets/index-OLD11111.js', 'old js'],
      ['https://game.example/breaker-3d/assets/index-2pE4IPmO.css', 'css'],
    ]);
    const cache = {
      match: async (req) => store.get(req.url),
      put: async (req, res) => { store.set(req.url, res); },
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (req) => store.delete(req.url),
    };
    const listeners = {};
    vm.runInNewContext(read('public/sw.js'), {
      self: { addEventListener: (n, fn) => { listeners[n] = fn; }, location: { origin: 'https://game.example' }, skipWaiting() {}, clients: { claim() {} } },
      caches: { open: async () => cache, keys: async () => [], delete: async () => true },
      fetch: async () => ({ ok: true, clone() { return 'new js'; } }),
      URL,
    });
    let done;
    listeners.fetch({ request: { url: 'https://game.example/breaker-3d/assets/index-NEW22222.js', method: 'GET' }, respondWith: (p) => { done = p; } });
    await done;
    await new Promise((r) => setTimeout(r, 0));
    expect(store.has('https://game.example/breaker-3d/assets/index-NEW22222.js')).toBe(true);
    expect(store.has('https://game.example/breaker-3d/assets/index-OLD11111.js')).toBe(false); // the old build of the same file
    expect(store.has('https://game.example/breaker-3d/assets/index-2pE4IPmO.css')).toBe(true); // a different file (the stylesheet)
  });
});

describe('toasts stay in their band', () => {
  it('a toast leaving the screen drifts up a little, not 40px into the boss bar', () => {
    const m = /@keyframes toast \{[^}]*\}[^@]*?100% \{ transform: translateY\(-(\d+)px\)/s.exec(css());
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeLessThanOrEqual(12);
  });

  it('the toast text shrinks to the band it has (set by layoutOverlays as --band)', () => {
    expect(css()).toMatch(/\.toast\.mega \{[^}]*var\(--band/);
    expect(ui()).toMatch(/setProperty\('--band'/);
  });

  it('layoutOverlays knows the lane between the box floor and the paddle (the fallback spot on wide and short screens)', () => {
    expect(ui()).toMatch(/function layoutOverlays\(boardTop, boxBottom, paddleTop\)/);
    expect(main()).toMatch(/ui\.layoutOverlays\(\s*stage\.project\(COLS \/ 2, level\.box\.top \+ 1, 0\)\.y,\s*stage\.project\(COLS \/ 2, level\.box\.bottom, 0\)\.y,\s*stage\.project\(COLS \/ 2, PADDLE_Y \+ PADDLE_H, 0\)\.y,?\s*\)/);
    // No room above the board (short landscape): the bar goes to the lane too, in its compact form.
    expect(ui()).toMatch(/classList\.toggle\('lane', compact\)/);
    expect(css()).toMatch(/#boss-bar\.lane \{/);
  });
});

describe('title screen', () => {
  it('shows the screen first and scrolls the stage grid to the current stage on the next frame (hidden elements have no size)', () => {
    const body = fnBody(ui(), 'showTitle');
    const shown = body.indexOf("show('screen-title')");
    const scroll = body.indexOf('grid.scrollTop =');
    expect(shown).toBeGreaterThan(-1);
    expect(scroll).toBeGreaterThan(shown);
    expect(body).toMatch(/requestAnimationFrame\(/);
    expect(body).toMatch(/\$\('screen-title'\)\.scrollTop = 0/);
  });

  it('the legend no longer promises ceiling holes (dropped in v33) and the fruit chips wrap on their own line', () => {
    expect(html()).not.toContain('아래·옆·위·모서리');
    expect(html()).toContain('아래·옆·모서리');
    expect(css()).toMatch(/\.legend li \{[^}]*flex-wrap: wrap/);
  });

  it('short landscape screens get a compact layout so the main buttons stay above the fold', () => {
    const m = /@media \(orientation: landscape\) and \(max-height: 500px\) \{([\s\S]*?)\n\}/.exec(css());
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/\.title-hero[^{]*\{[^}]*display: none/);
    expect(m[1]).toMatch(/\.stats \{[^}]*grid-template-columns: 1fr auto 1fr auto/);
    expect(m[1]).toMatch(/\.stage-grid \{[^}]*max-height: 22vh/);
  });
});

describe('touch targets and ways out', () => {
  it('small icon buttons and text links reach 44px of touch area', () => {
    expect(css()).toMatch(/\.icon-btn::after \{[^}]*inset: -6px/);
    expect(css()).toMatch(/\.link \{[^}]*min-height: 44px/);
  });

  it('achievements and credits have a close button that stays in view, and Esc closes them', () => {
    expect(html()).toContain('id="btn-achv-close"');
    expect(html()).toContain('id="btn-credits-close"');
    expect(css()).toMatch(/\.close-x \{[^}]*position: sticky/);
    expect(ui()).toMatch(/bind\('btn-achv-close', h\.onMenu\)/);
    expect(ui()).toMatch(/bind\('btn-credits-close', h\.onMenu\)/);
    expect(ui()).toMatch(/function closeSubscreen\(\)/);
    expect(main()).toMatch(/e\.code === 'Escape' && mode === 'title' && ui\.closeSubscreen\(\)/);
  });
});

describe('icons and copy', () => {
  it('the clear screen draws stats and bonus lines through the icon system (no OS emoji for the coin)', () => {
    const body = fnBody(ui(), 'showClear');
    expect(body).toMatch(/setRich\(dd, v\)/);
    expect(body).toMatch(/setRich\(li, line\)/);
    expect(body).not.toMatch(/textContent: line/);
  });

  it('the split toast names the multiplier that was bought', () => {
    const level = getLevel(0);
    const w = createWorld(level.lines, { box: level.box, holes: level.holes, charges: { split: 1, meteor: 0 }, rng: () => 0.5 });
    launch(w, 0);
    drainEvents(w);
    expect(useSkill(w, 'split', 5)).toBe(true);
    const ev = drainEvents(w).find((e) => e.t === 'skill');
    expect(ev).toMatchObject({ name: 'split', mult: 5 });
    expect(read('src/director.js')).toMatch(/전체 ×\$\{e\.mult/);
  });
});

describe('loading and memory', () => {
  it('the web font stylesheet does not block the first paint, and the page background is inline', () => {
    const link = /<link rel="preload" as="style" href="https:\/\/cdn\.jsdelivr\.net[^"]*pretendard[^"]*" onload="[^"]*rel='stylesheet'[^"]*"/;
    expect(html()).toMatch(link);
    expect(html()).toMatch(/<noscript><link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net[^"]*pretendard/);
    expect(html()).toMatch(/<style>[\s\S]*html, body \{ background: #06080f; \}/);
  });

  it('landmark photo textures are kept for the last few stages only and freed after that', () => {
    const src = read('src/render/photo.js');
    expect(src).toMatch(/import \{ lruTouch \} from '\.\/bossFit\.js'/);
    expect(src).toMatch(/\.dispose\(\)/);
  });

  it('a boss model that failed to load is tried again next time (no permanent miss after a network blip)', () => {
    const src = read('src/render/bossModels.js');
    expect(src).toMatch(/\.catch\(\(\) => \{[^}]*cache\.delete\(kind\)/);
  });

  it('the stage-start toasts run on the stage timers, so leaving the stage calls them off', () => {
    const body = fnBody(ui(), 'startStage');
    expect(body).not.toMatch(/\bsetTimeout\(/);
    expect(body).toMatch(/later\(/);
    expect(main()).toMatch(/later: \(fn, ms\) => stageTimers\.later\(fn, ms\)/);
  });
});

describe('one source for shared values', () => {
  it("the boss's landing time, the 'BOSS · ' prefix and the trail width each live in one place", () => {
    expect(read('src/render/boss3d.js')).toMatch(/export const ENTRY_TIME = 0\.8/);
    expect(main()).toMatch(/ENTRY_TIME \* 1000/);
    expect(main()).not.toMatch(/BOSS_LANDING_MS = 800/);
    expect(read('src/sim/maps.js')).toMatch(/export const BOSS_PREFIX = 'BOSS · '/);
    expect(main()).not.toContain("'BOSS · '");
    expect(read('src/sim/levels.js')).not.toContain('`BOSS · ');
    expect(read('src/render/balls3d.js')).toMatch(/export const BALL_DRAW/);
    expect(read('src/render/trails3d.js')).toMatch(/import \{ BALL_DRAW \} from '\.\/balls3d\.js'/);
  });
});

describe('CI', () => {
  it('the Android workflow caches Gradle and cancels a superseded run of the same branch', () => {
    const yml = read('.github/workflows/android.yml');
    expect(yml).toMatch(/cache: gradle/);
    expect(yml).toMatch(/concurrency:\s*\n\s*group: android-\$\{\{ github\.ref \}\}\s*\n\s*cancel-in-progress: true/);
  });
});
