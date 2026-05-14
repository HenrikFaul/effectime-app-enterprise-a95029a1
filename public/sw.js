// Effectime Service Worker (v3.32.0 — Top-20 Rank 7 MVP).
//
// Minimal offline-first scaffold:
//   - Static asset precache (app shell after first load).
//   - NetworkFirst for API calls (always try fresh, fall back to cache).
//   - CacheFirst for static assets (icons, fonts).
//
// Full Workbox + vite-plugin-pwa + IndexedDB write queue + FCM push are
// deferred to v3.32.1+ when the build pipeline is upgraded.

const CACHE_VERSION = 'effectime-v3.32.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/effectime-favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // Cache the app shell on install
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Sweep stale caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass Supabase Auth / Edge functions / Realtime
  if (
    url.host.includes('supabase.co') ||
    url.host.includes('supabase.in') ||
    url.pathname.startsWith('/functions/v1/') ||
    url.pathname.startsWith('/auth/v1/') ||
    url.pathname.startsWith('/realtime/v1/')
  ) {
    return; // Let the request go to network unmediated
  }

  // Same-origin navigation requests → NetworkFirst with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/')),
        ),
    );
    return;
  }

  // Static assets → CacheFirst
  if (
    url.pathname.match(/\.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|webp|ico)$/i)
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else: NetworkFirst with cache fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
