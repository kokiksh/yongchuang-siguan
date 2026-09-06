const CACHE = 'ycsg-v3';
const ASSETS = ['./', './index.html', './style.css', './app.js', './data.js',
  './manifest.webmanifest', './icon-512.png', './apple-touch-icon.png', './icon.svg', './comic.jpg'];
const NETWORK_FIRST = p => /\.(html|js|css)$/.test(p) || p.endsWith('/');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (NETWORK_FIRST(url.pathname)) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
  }
});
