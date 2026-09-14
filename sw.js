/* cloth-measure service worker
   Strategy chosen to avoid stale-version pain:
   - index.html / navigations: NETWORK FIRST, cache only as offline fallback,
     so a deployed update is always picked up when online.
   - opencv.js and other static GETs: cache first (the CDN URL pins an exact
     version, it can never go stale).                                       */
const VER = 'cm-pwa-2';
const CV  = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    try { await c.add('./index.html'); } catch (err) {}
    try { await c.add(new Request(CV, { mode: 'no-cors' })); } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;          // Gemini API POSTs pass through
  const u = new URL(e.request.url);
  if (e.request.mode === 'navigate' || u.pathname.endsWith('/index.html')) {
    e.respondWith((async () => {
      const c = await caches.open(VER);
      try {
        // no-cache: 跳過瀏覽器 HTTP 快取（GitHub Pages max-age=600 會讓手機黏在舊版）
        const r = await fetch(e.request, { cache: 'no-cache' });
        c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        const m = await c.match('./index.html');
        if (m) return m;
        throw err;
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const m = await c.match(e.request);
    if (m) return m;
    const r = await fetch(e.request);
    if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone());
    return r;
  })());
});
