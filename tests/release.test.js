import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('release paperwork', () => {
  it('ships the open-source notices (three.js MIT, Pretendard OFL)', () => {
    const txt = read('public/licenses.txt');
    expect(txt).toMatch(/three\.js authors/i);
    expect(txt).toMatch(/Permission is hereby granted, free of charge/);
    expect(txt).toMatch(/Pretendard/);
    expect(txt).toMatch(/SIL Open Font License/);
  });

  it('has a privacy policy that says what is (and is not) collected', () => {
    const html = read('public/privacy.html');
    expect(html).toMatch(/개인정보/);
    expect(html).toMatch(/localStorage|브라우저 저장소/);
    expect(html).toMatch(/광고|분석/);
  });

  it('the game links to the privacy policy and the licences', () => {
    const html = read('index.html');
    expect(html).toMatch(/href="[^"]*privacy\.html"/);
    expect(html).toMatch(/href="[^"]*licenses\.txt"/);
  });

  it('describes itself for search and link previews', () => {
    const html = read('index.html');
    expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
    expect(html).toMatch(/<meta property="og:title"/);
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+og-image\.jpg"/);
  });

  it('tells people without JavaScript or WebGL what is wrong (no blank page)', () => {
    const html = read('index.html');
    expect(html).toMatch(/<noscript>/);
    expect(html).toMatch(/id="boot-error"/);
  });
});

describe('offline cache (service worker)', () => {
  /** Runs public/sw.js in a sandbox and returns its fetch handler. */
  function loadWorker() {
    const listeners = {};
    const sandbox = {
      self: { addEventListener: (n, fn) => { listeners[n] = fn; }, location: { origin: 'https://game.example' }, skipWaiting() {}, clients: { claim() {} } },
      caches: { open: async () => ({ match: async () => undefined, put: async () => {} }), keys: async () => [], delete: async () => true },
      fetch: async () => ({ ok: true, clone() { return this; } }),
      URL,
    };
    vm.runInNewContext(read('public/sw.js'), sandbox);
    return listeners;
  }

  const handled = (listeners, url, method = 'GET') => {
    let responded = false;
    listeners.fetch({ request: { url, method }, respondWith: () => { responded = true; } });
    return responded;
  };

  it('installs, activates and handles fetches', () => {
    const l = loadWorker();
    expect(Object.keys(l).sort()).toEqual(['activate', 'fetch', 'install']);
  });

  it('caches the game itself and its photos', () => {
    const l = loadWorker();
    expect(handled(l, 'https://game.example/breaker-3d/')).toBe(true);
    expect(handled(l, 'https://game.example/breaker-3d/assets/index-abc.js')).toBe(true);
    expect(handled(l, 'https://game.example/breaker-3d/landmarks/giza.jpg')).toBe(true);
  });

  it('caches the web font so the game looks right offline', () => {
    expect(handled(loadWorker(), 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/x.woff2')).toBe(true);
  });

  it('a new build file replaces the old one of the same name (no pile-up across deploys)', async () => {
    const store = new Map([
      ['https://game.example/breaker-3d/assets/main-OLD11-_1.js', 'old main'],
      ['https://game.example/breaker-3d/assets/index-OLD22222.css', 'old css'],
      ['https://game.example/breaker-3d/landmarks/giza.jpg', 'photo'],
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
      fetch: async () => ({ ok: true, clone() { return 'new main'; } }),
      URL,
    });
    let done;
    listeners.fetch({ request: { url: 'https://game.example/breaker-3d/assets/main-NEW33333.js', method: 'GET' }, respondWith: (p) => { done = p; } });
    await done;
    await new Promise((r) => setTimeout(r, 0));
    expect(store.has('https://game.example/breaker-3d/assets/main-NEW33333.js')).toBe(true);
    expect(store.has('https://game.example/breaker-3d/assets/main-OLD11-_1.js')).toBe(false);
    expect(store.has('https://game.example/breaker-3d/assets/index-OLD22222.css')).toBe(true); // a different file
    expect(store.has('https://game.example/breaker-3d/landmarks/giza.jpg')).toBe(true);
  });

  /** A worker over an in-memory cache; `put` can be made to fail like a full disk. */
  function workerWith(store, { putFails = false } = {}) {
    const cache = {
      match: async (req) => store.get(req.url),
      put: async (req, res) => { if (putFails) throw new Error('QuotaExceededError'); store.set(req.url, res); },
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (req) => store.delete(req.url),
    };
    const listeners = {};
    vm.runInNewContext(read('public/sw.js'), {
      self: { addEventListener: (n, fn) => { listeners[n] = fn; }, location: { origin: 'https://game.example' }, skipWaiting() {}, clients: { claim() {} } },
      caches: { open: async () => cache, keys: async () => [], delete: async () => true },
      fetch: async () => ({ ok: true, body: 'fresh', clone() { return this; } }),
      URL,
    });
    return async (url) => {
      let done;
      listeners.fetch({ request: { url, method: 'GET' }, respondWith: (p) => { done = p; } });
      const res = await done;
      await new Promise((r) => setTimeout(r, 0));
      return res;
    };
  }

  it('a full disk (cache write fails) still hands over the downloaded file', async () => {
    const get = workerWith(new Map(), { putFails: true });
    expect((await get('https://game.example/breaker-3d/art/model/mummy.glb?v=1')).body).toBe('fresh');
  });

  it('a redrawn picture (new ?v=) replaces its old version in the cache', async () => {
    const store = new Map([
      ['https://game.example/breaker-3d/art/fruit/apple.png?v=1', 'old apple'],
      ['https://game.example/breaker-3d/art/fruit/cherry.png?v=1', 'cherry'],
    ]);
    await workerWith(store)('https://game.example/breaker-3d/art/fruit/apple.png?v=2');
    expect(store.has('https://game.example/breaker-3d/art/fruit/apple.png?v=2')).toBe(true);
    expect(store.has('https://game.example/breaker-3d/art/fruit/apple.png?v=1')).toBe(false);
    expect(store.has('https://game.example/breaker-3d/art/fruit/cherry.png?v=1')).toBe(true);
  });

  it('leaves everything else alone (other sites, non-GET)', () => {
    const l = loadWorker();
    expect(handled(l, 'https://commons.wikimedia.org/wiki/File:X.jpg')).toBe(false);
    expect(handled(l, 'https://game.example/breaker-3d/', 'POST')).toBe(false);
  });
});
