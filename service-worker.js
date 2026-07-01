/**
 * service-worker.js
 * Caches the static app shell (HTML/CSS/JS/icons) so the PWA installs
 * and opens instantly even with a poor connection. API calls to the
 * Apps Script backend always go to the network (booking data must never
 * be served stale), but if there's genuinely no connection, fetch() will
 * fail and the frontend shows the "No internet connection" message
 * itself (see js/api.js).
 */

var CACHE_NAME = 'altius-booking-v1';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/api.js',
  './js/utils.js',
  './js/seatmap.js',
  './js/auth.js',
  './js/member.js',
  './js/reception.js',
  './js/admin.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Never cache calls to the Apps Script API - booking data must always be live.
  if (url.hostname.indexOf('script.google.com') !== -1 || url.hostname.indexOf('script.googleusercontent.com') !== -1) {
    return; // let the browser handle it normally (network only)
  }

  // App shell: cache-first, falling back to network, so the app opens instantly offline.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (event.request.method === 'GET' && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function () {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
