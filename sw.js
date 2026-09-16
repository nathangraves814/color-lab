/* Cache everything on install so the app works with no wifi at all.
   Bump CACHE when files change and the old one is dropped on activate. */
var CACHE = 'color-lab-v2';
var ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png',
  './voice/manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // The voice pack is ~190 files, so it ships its own manifest rather than
    // being listed here by hand. Clip failures must not fail the install.
    return c.addAll(ASSETS).then(function () {
      return fetch('./voice/manifest.json')
        .then(function (r) { return r.json(); })
        .then(function (m) {
          return Promise.all(m.files.map(function (f) {
            return c.add('./voice/' + f).catch(function () {});
          }));
        }).catch(function () {});
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
