// Offline cache for BREAKER 3D.
// - The page and JSON: network first (a new deploy shows up at once), cache when offline.
// - Hashed build files, landmark photos and the web font: cache first (fast, offline).
// Everything else (other sites, non-GET requests) is left to the browser.

const CACHE = 'breaker3d-v2'; // v2: new icons and title art (2026-10-28)
const FONT_HOST = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('breaker3d-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** @returns {boolean} whether this request is ours to cache */
function ours(request) {
  if (request.method !== 'GET') return false;
  return request.url.startsWith(self.location.origin + '/') || request.url.startsWith(FONT_HOST);
}

/** Pages and data change between deploys; files with a hash or photos don't. */
function fresh(request) {
  const path = new URL(request.url).pathname;
  return request.mode === 'navigate' || path.endsWith('/') || path.endsWith('.html') || path.endsWith('.json') || path.endsWith('.webmanifest');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await keep(cache, request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

/**
 * "/assets/main-AbC12_9x.js" -> "/assets/main" (a build file's name without its 8-character
 * hash; the hash itself may contain "-" or "_"), else null.
 */
function stem(url) {
  const m = /^(.*\/assets\/[^/]+?)-[\w-]{8}\.\w+$/.exec(new URL(url).pathname);
  return m ? m[1] : null;
}

/** "/art/x.png?v=2" -> "/art/x.png": a versioned file without its version, else null. */
function unversioned(url) {
  const u = new URL(url);
  return u.search ? u.origin + u.pathname : null;
}

/** Drops older builds and older versions of the same file, so each deploy doesn't add to the pile. */
async function pruneOlder(cache, url) {
  const s = stem(url);
  const plain = unversioned(url);
  if (!s && !plain) return;
  for (const req of await cache.keys()) {
    if (req.url === url) continue;
    if ((s && stem(req.url) === s) || (plain && unversioned(req.url) === plain)) await cache.delete(req);
  }
}

/** Storing a copy is a bonus: a full disk (quota) must not turn a good download into an error. */
async function keep(cache, request, res) {
  try {
    await cache.put(request, res);
    return true;
  } catch {
    return false;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && (await keep(cache, request, res.clone()))) pruneOlder(cache, request.url).catch(() => {});
  return res;
}

self.addEventListener('fetch', (event) => {
  if (!ours(event.request)) return;
  event.respondWith(fresh(event.request) ? networkFirst(event.request) : cacheFirst(event.request));
});
