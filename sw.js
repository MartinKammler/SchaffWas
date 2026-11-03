/* Service Worker für "Schaff was!"
   Strategie:
   - App-Shell → Cache-First (die App startet auch ohne Netz)
   - alles andere → Network-First mit Cache-Fallback

   CACHE_NAME und APP_SHELL kommen aus sw-shell.js, die Version aus
   version.js. importScripts ist im SW-Kontext synchron und stößt den
   Update-Mechanismus an, sobald sich eine der Dateien ändert. */

try {
  importScripts('./version.js', './sw-shell.js');
} catch (e) {
  // Ohne die Konstanten ist kein sinnvoller Cache möglich: der SW bleibt
  // passiv und reicht alle Anfragen durch.
}

const CACHE_NAME = (typeof SW_CACHE_NAME === 'string') ? SW_CACHE_NAME : null;
const APP_SHELL = (typeof SW_APP_SHELL !== 'undefined') ? SW_APP_SHELL : [];

self.addEventListener('install', event => {
  if (!CACHE_NAME) return;
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(
        namen.filter(n => typeof swShouldDeleteCache === 'function' && swShouldDeleteCache(n))
          .map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

function istShell(url) {
  const pfad = url.pathname;
  return APP_SHELL.some(p => {
    const datei = p.replace('./', '');
    return datei === '' ? pfad.endsWith('/') : pfad.endsWith('/' + datei);
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !CACHE_NAME) return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (istShell(url)) {
    // Cache-First: offline startklar.
    event.respondWith(
      caches.match(req).then(treffer => treffer || fetch(req).then(res => {
        const kopie = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, kopie)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Network-First mit Cache-Fallback.
  event.respondWith(
    fetch(req).then(res => {
      const kopie = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, kopie)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
