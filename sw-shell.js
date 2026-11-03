/* sw-shell.js — was der Service Worker cachen soll und wie sein Cache heißt.
   Eigene Datei, damit sw.js (per importScripts) und die Testsuite (per
   <script>) dieselbe Quelle benutzen statt zweier Kopien. */

var SW_CACHE_PREFIX = 'sw-shell-';

// APP_VERSION kommt aus version.js — einzige Quelle der Version.
var SW_CACHE_NAME = SW_CACHE_PREFIX + 'v' + (typeof APP_VERSION === 'string' ? APP_VERSION : '0');

var SW_APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.json',
  './version.js',
  './storage.js',
  './model.js',
  './clock.js',
  './taunts.js',
  './ui.js',
  './ui-main.js',
  './ui-log.js',
  './ui-history.js',
  './ui-settings.js',
  './app.js',
  './Logo.png',
  './Logo-Sau.png',
  './Logo-Schriftzug.png',
  './Logo-icon.png',
  './Logo-icon-maskable.png'
];

// Unter derselben Herkunft liegen weitere Apps (LifeguardClock, LifeguardCount).
// Aufgeräumt wird ausschließlich, was dieses Präfix trägt und veraltet ist.
function swShouldDeleteCache(name) {
  return typeof name === 'string'
    && name.indexOf(SW_CACHE_PREFIX) === 0
    && name !== SW_CACHE_NAME;
}

// Gehört dieser Pfad zur App-Shell? Die App liegt unter einem Unterpfad
// (/SchaffWas/), darum wird das Dateiende verglichen und nicht der ganze Pfad.
// Der Eintrag './' ist das Verzeichnis selbst.
function swIstShellPfad(pfad, shell) {
  var liste = shell || SW_APP_SHELL;
  return liste.some(function (p) {
    var datei = p.replace('./', '');
    return datei === '' ? /\/$/.test(pfad) : pfad.endsWith('/' + datei);
  });
}

/* Welche Einträge der App-Shell fehlen im Cache?
   Liefert ein Promise mit der Liste der Fehlenden (leer = vollständig).
   Gefragt wird mit cache.match und denselben relativen Pfaden, die addAll
   bekommen hat — die lösen sich genauso auf, deshalb wird hier nicht an
   URL-Zeichenketten gebastelt. */
function swFehlendeShellDateien(cache, shell) {
  var liste = shell || SW_APP_SHELL;
  return Promise.all(liste.map(function (p) {
    return Promise.resolve()
      .then(function () { return cache.match(p); })
      .then(function (treffer) { return treffer ? null : p; }, function () { return p; });
  })).then(function (ergebnis) {
    return ergebnis.filter(function (p) { return p !== null; });
  });
}

/* Legt die App-Shell in den Cache und prüft nach, dass sie vollständig ist.
   Das Promise lehnt ab, wenn etwas fehlt — eine halbe Shell ist ein
   Installationsfehler, kein Teilerfolg: der alte Worker bleibt dann aktiv und
   sein vollständiger Cache stehen, statt dass die App offline nicht mehr
   startet.
   Absichtlich wird dabei nichts gelöscht: der halbvolle Cache kann denselben
   Namen tragen wie der des aktiven Workers (gleiche APP_VERSION, nur sw.js
   geändert) — ihn wegzuräumen würde genau die Offline-Fähigkeit zerstören,
   die hier geschützt wird. Der nächste Installationsversuch füllt ihn auf. */
function swInstalliereShell(cache, shell) {
  var liste = shell || SW_APP_SHELL;
  return Promise.resolve()
    .then(function () { return cache.addAll(liste); })
    .then(function () { return swFehlendeShellDateien(cache, liste); })
    .then(function (fehlend) {
      if (fehlend.length) {
        throw new Error('App-Shell unvollständig, es fehlen: ' + fehlend.join(', '));
      }
      return true;
    });
}
