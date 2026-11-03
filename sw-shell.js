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
