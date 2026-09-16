/* Two caching strategies, because the two kinds of asset want opposite things.

   The app shell (html/css/js) is network-first: it changes on every deploy, so a
   stale copy is a bug. The voice clips are cache-first: ~190 immutable files that
   should never cost a round trip once they are on the device.

   The earlier version cached everything cache-first, which meant a phone that had
   loaded the app once would keep running that build forever. */

var VERSION = '1.3.1';
var CACHE = 'color-lab-' + VERSION;

var SHELL = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png',
  './voice/manifest.json'
];

function isVoiceClip(url) { return /\/voice\/.+\.m4a$/.test(url); }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // {cache:'reload'} forces these past the browser's own HTTP cache, otherwise a
    // fresh service worker can install a stale shell and the bug survives the fix.
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }))
      .then(function () {
        return fetch('./voice/manifest.json', { cache: 'reload' })
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
  var req = e.request;
  if (req.method !== 'GET') return;

  if (isVoiceClip(req.url)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    }));
    return;
  }

  // Shell: revalidate against the network, fall back to cache when offline.
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
      });
    })
  );
});
