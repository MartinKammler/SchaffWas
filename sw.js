/* Service Worker für "Schaff was!"
   Strategie:
   - App-Shell → Cache-First (die App startet auch ohne Netz)
   - alles andere → Network-First mit Cache-Fallback

   CACHE_NAME und APP_SHELL kommen aus sw-shell.js, die Version aus
   version.js. importScripts ist im SW-Kontext synchron und stößt den
   Update-Mechanismus an, sobald sich eine der Dateien ändert. */

/* Die Versionsnummer steht hier ein zweites Mal — mit Absicht.
   Der Browser erkennt ein Update ausschliesslich daran, dass sich dieses
   Hauptskript Byte fuer Byte aendert. version.js kommt per importScripts
   und wird dabei aus dem HTTP-Cache bedient (GitHub Pages: max-age=600),
   taugt also nicht als Ausloeser: eine Auslieferung, die nur version.js
   bumpt, bleibt auf einem installierten Geraet unsichtbar. Genau das ist
   zwischen 1.4.0 und 1.5.0 passiert.
   Damit die beiden Stellen nicht auseinanderlaufen, prueft
   tests/test_sw.html, dass sie gleich sind. */
const SW_SCRIPT_VERSION = '1.5.1';

try {
  importScripts('./version.js', './sw-shell.js');
} catch (e) {
  // Ohne die Konstanten ist kein sinnvoller Cache möglich: der SW bleibt
  // passiv und reicht alle Anfragen durch.
}

const CACHE_NAME = (typeof SW_CACHE_NAME === 'string') ? SW_CACHE_NAME : null;
const APP_SHELL = (typeof SW_APP_SHELL !== 'undefined') ? SW_APP_SHELL : [];

/* Installation: entweder liegt die App-Shell vollständig im Cache — oder die
   Installation ist gescheitert. Kein catch: lehnt das Promise ab, verwirft der
   Browser diesen Worker, der alte bleibt aktiv und sein vollständiger Cache
   stehen. Würde hier geschluckt, käme der halbe Worker durch und würde im
   activate den letzten brauchbaren Cache löschen — die App startete offline
   nicht mehr.
   Auch kein skipWaiting: der neue Worker wartet, bis der Nutzer im Hinweis
   „Neue Version verfügbar" zustimmt (app.js schickt dann SKIP_WAITING). Sonst
   würde mitten im Tippen oder bei laufender Uhr gewechselt. */
self.addEventListener('install', event => {
  if (!CACHE_NAME || typeof swInstalliereShell !== 'function') return;
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => swInstalliereShell(cache, APP_SHELL))
  );
});

// Das Warten endet nur auf Zustimmung des Nutzers hin, nie von selbst.
self.addEventListener('message', event => {
  const typ = event.data && event.data.typ;
  if (typ === 'SKIP_WAITING') self.skipWaiting();
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

// Dieselbe Zuordnung wie beim Installieren — eine Quelle in sw-shell.js.
function istShell(url) {
  return typeof swIstShellPfad === 'function' && swIstShellPfad(url.pathname, APP_SHELL);
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
