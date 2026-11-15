// APP_VERSION is replaced at build time (scripts/build.mjs) so every deploy
// produces a byte-different sw.js, which is what makes browsers install it.
const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = 'mesai-defteri-shell-' + APP_VERSION;
// Yollar sw.js'in bulunduğu klasöre göre (Netlify kökü veya GitHub Pages alt klasörü)
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'tailwind.css', 'app.css', 'supabase.min.js', 'supabase-config.js', 'hesaplama.js', 'sync.js', 'app.js', 'alpine.min.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(f => BASE + f);

self.addEventListener('install', event => {
  // cache: 'reload' bypasses the HTTP cache so the new shell is really new.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith(BASE + 'api/')) return;
  // version.json must always come straight from the network.
  if (url.pathname === BASE + 'version.json') {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
  const isNav = req.mode === 'navigate';
  // Network-first with HTTP revalidation (cache: 'no-cache' -> conditional GET / 304).
  const netReq = isNav ? new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' });
  event.respondWith(
    fetch(netReq).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(isNav ? BASE : req, copy));
      }
      return response;
    }).catch(() =>
      caches.match(isNav ? BASE : req, { ignoreSearch: true })
        .then(cached => cached || (isNav ? caches.match(BASE) : undefined))
        .then(cached => cached || Response.error())
    )
  );
});
