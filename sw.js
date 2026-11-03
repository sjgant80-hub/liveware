// sw.js — offline shell for Liveware. Precache the page, its kernels and the sealed receipts; serve network-first for
// same-origin, falling back to cache so the whole organism keeps working with the network off after first load.
const V = 'liveware-2';
const ASSETS = [
  './', './index.html', './page/app.css', './page/app.mjs', './page/t11-worker.mjs', './manifest.webmanifest',
  './src/wave1.mjs', './src/seed.mjs', './src/door.mjs', './src/mesh.mjs', './src/compress.mjs', './src/receipt.mjs', './src/rng.mjs', './src/t11.mjs',
  './vendor/fall-kit/core/identity.mjs', './vendor/fall-kit/core/antibody.mjs',
  './vendor/fall-kit/core/vendor/light/codec.mjs', './vendor/fall-kit/core/vendor/light/packet.mjs',
  './vendor/fall-kit/core/vendor/light/sha256.mjs', './vendor/fall-kit/core/vendor/sync/crdt.mjs',
  './vendor/ai-first-company/src/distill.mjs', './vendor/ai-first-company/src/baseline.mjs', './vendor/ai-first-company/src/experiment.mjs',
  './vendor/ai-first-company/src/journal.mjs', './vendor/ai-first-company/vendor/fall-kit/light/sha256.mjs',
  './vendor/ai-first-company/data/mint-demo-car.data', './vendor/ai-first-company/data/mint-demo-mushroom.data',
  './vendor/ai-first-company/data/mint-demo-run.json', './vendor/ai-first-company/data/mint-demo-v2-run.json', './vendor/ai-first-company/data/mint-demo-v3-run.json',
  './receipts/wave1.json', './receipts/wave1-detail.json', './receipts/t11.json', './receipts/t11-detail.json', './samples/MANIFEST.json',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
