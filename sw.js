// Service worker: keeps the app's own files and the CesiumJS library on the device so the app
// starts fast. Google 3D tiles and Cesium ion requests always go to the network: their terms do
// not allow storing them.
const CACHE = 'boni-v1';
const NEVER = ['tile.googleapis.com', 'api.cesium.com', 'assets.ion.cesium.com'];
const LIBS = ['cdn.jsdelivr.net/npm/cesium@'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'intro.html', 'index.html', 'manifest.webmanifest', 'css/style.css'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER.some((h) => url.hostname === h)) return; // network only
  const own = url.origin === self.location.origin;
  const lib = LIBS.some((p) => req.url.includes(p));
  if (!own && !lib) return;
  if (lib) {
    // versioned library files never change: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })));
    return;
  }
  // own files: network first (updates arrive at once), cache when offline
  e.respondWith(fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => caches.match(req, { ignoreSearch: true })));
});
