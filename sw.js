// sw.js — offline shell for Liveware. Precache the page, its kernels and the sealed receipts; serve network-first for
// same-origin, falling back to cache so the whole organism keeps working with the network off after first load.
const V = 'liveware-1';
const ASSETS = [
  './', './index.html', './page/app.css', './page/app.mjs', './manifest.webmanifest',
  './src/wave1.mjs', './src/seed.mjs', './src/door.mjs', './src/mesh.mjs', './src/compress.mjs', './src/receipt.mjs', './src/rng.mjs',
  './vendor/fall-kit/core/identity.mjs', './vendor/fall-kit/core/antibody.mjs',
  './vendor/fall-kit/core/vendor/light/codec.mjs', './vendor/fall-kit/core/vendor/light/packet.mjs',
  './vendor/fall-kit/core/vendor/light/sha256.mjs', './vendor/fall-kit/core/vendor/sync/crdt.mjs',
  './receipts/wave1.json', './receipts/wave1-detail.json', './samples/MANIFEST.json',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
