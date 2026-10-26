import { describe, it, expect } from 'vitest';
import { createFullscreen } from '../src/fullscreen.js';

function fakeDoc({ webkit = false, supported = true } = {}) {
  const calls = [];
  const doc = { fullscreenElement: null, webkitFullscreenElement: null, listeners: {} };
  const el = {};
  if (supported && !webkit) {
    doc.fullscreenEnabled = true;
    el.requestFullscreen = () => { calls.push('enter'); doc.fullscreenElement = el; return Promise.resolve(); };
    doc.exitFullscreen = () => { calls.push('exit'); doc.fullscreenElement = null; return Promise.resolve(); };
  }
  if (supported && webkit) {
    doc.webkitFullscreenEnabled = true;
    el.webkitRequestFullscreen = () => { calls.push('enter'); doc.webkitFullscreenElement = el; };
    doc.webkitExitFullscreen = () => { calls.push('exit'); doc.webkitFullscreenElement = null; };
  }
  doc.documentElement = el;
  doc.addEventListener = (n, fn) => { doc.listeners[n] = fn; };
  return { doc, calls };
}

describe('fullscreen', () => {
  it('toggles in and out', async () => {
    const { doc, calls } = fakeDoc();
    const fs = createFullscreen(doc);
    expect(fs.supported).toBe(true);
    expect(fs.active).toBe(false);
    await fs.toggle();
    expect(fs.active).toBe(true);
    await fs.toggle();
    expect(calls).toEqual(['enter', 'exit']);
    expect(fs.active).toBe(false);
  });

  it('works with the webkit-prefixed API (older Safari / Samsung Internet)', async () => {
    const { doc, calls } = fakeDoc({ webkit: true });
    const fs = createFullscreen(doc);
    expect(fs.supported).toBe(true);
    await fs.toggle();
    expect(fs.active).toBe(true);
    expect(calls).toEqual(['enter']);
  });

  it('reports unsupported (iPhone Safari) and does nothing', async () => {
    const { doc } = fakeDoc({ supported: false });
    const fs = createFullscreen(doc);
    expect(fs.supported).toBe(false);
    await expect(fs.toggle()).resolves.toBe(false);
  });

  it('a refused request does not throw', async () => {
    const { doc } = fakeDoc();
    doc.documentElement.requestFullscreen = () => Promise.reject(new Error('denied'));
    const fs = createFullscreen(doc);
    await expect(fs.toggle()).resolves.toBe(false);
  });

  it('notifies when the state changes (e.g. the user pressed Esc)', () => {
    const { doc } = fakeDoc();
    const fs = createFullscreen(doc);
    let seen = null;
    fs.onChange((on) => { seen = on; });
    doc.fullscreenElement = doc.documentElement;
    doc.listeners.fullscreenchange();
    expect(seen).toBe(true);
  });
});
