// APP_VERSION is replaced at build time (scripts/build.mjs) so every deploy
// produces a byte-different sw.js, which is what makes browsers install it.
const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = 'mesai-defteri-shell-' + APP_VERSION;
// Yollar sw.js'in bulunduğu klasöre göre (Netlify kökü veya GitHub Pages alt klasörü)
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'app.css', 'paper.jpg', 'supabase.min.js', 'supabase-config.js', 'hesaplama.js', 'sync.js', 'app.js', 'alpine.min.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png', 'favicon-32.png'].map(f => BASE + f);
// Ağ bu kadar sürede yanıt vermezse ve önbellekte tam eşleşen kopya varsa o sunulur
// (iOS'ta zayıf/kesik bağlantıda beyaz ekranda takılmasın). Ağ yanıtı arka planda önbelleği yine günceller.
const SLOW_MS = 5000;

self.addEventListener('install', event => {
  // cache: 'reload' bypasses the HTTP cache so the new shell is really new.
  // Dosyalar tek tek önbelleğe alınır: biri inemezse (zayıf ağ) diğerleri yine çevrimdışı kabukta kalır
  // (addAll ya hep ya hiç: tek hata tüm kabuğu boş bırakıyordu; eksikler ilk kullanımda ağdan önbelleğe girer).
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(SHELL.map(u => cache.add(new Request(u, { cache: 'reload' })))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('mesai-defteri-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
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
  const key = isNav ? BASE : req;
  // Sürümlü dosya (index.html'de ?v=<sürüm>): içeriği o sürüm için sabit → önbellekte varsa ağa hiç gidilmez
  if (!isNav && url.searchParams.has('v')) {
    event.respondWith(caches.match(req).then(cached => cached || networkFirst(event, req, url, false, req)));
    return;
  }
  event.respondWith(networkFirst(event, req, url, isNav, key));
});

function networkFirst(event, req, url, isNav, key) {
  // Network-first with HTTP revalidation (cache: 'no-cache' -> conditional GET / 304).
  const netReq = isNav ? new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' });
  const network = fetch(netReq).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).catch(() => {}));
    }
    return response;
  });
  event.waitUntil(network.catch(() => {}));
  // Çevrimdışı: önce tam eşleşme (?v= aynı sürüm), yoksa sorgusuz eşleşme, gezinmede uygulama kabuğu
  const offline = () => caches.match(key)
    .then(cached => cached || caches.match(key, { ignoreSearch: true }))
    .then(cached => cached || (isNav ? caches.match(BASE) : undefined))
    .then(cached => cached || Response.error());
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (r && !done) { done = true; resolve(r); } };
    // Yavaş ağ: yalnız tam eşleşen kopya (farklı sürümden dosya karışmasın); yoksa ağı beklemeye devam
    const slow = setTimeout(() => caches.match(key).then(finish, () => {}), SLOW_MS);
    network.then(
      r => { clearTimeout(slow); finish(r); },
      () => { clearTimeout(slow); offline().then(finish, () => finish(Response.error())); }
    );
  });
}
