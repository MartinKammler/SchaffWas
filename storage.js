/* storage.js — die einzige Speicherschicht der App.
   Alles, was die App liest oder schreibt, läuft hier durch. Das ist die
   Voraussetzung dafür, dass später eine WebDAV-Synchronisation darüber
   gelegt werden kann (Spec §10).

   Schlüssel (alle mit Präfix sw_, fremde Schlüssel derselben Herkunft
   werden nie angefasst):
     sw_config          Konfiguration
     sw_log_YYYY-MM     Protokoll eines Monats
     sw_running         laufender Eintrag
     sw_last_change     Zeitpunkt der letzten erfolgreichen Schreibung
     sw_last_export     Zeitpunkt des letzten Exports
*/
window.SW = window.SW || {};

SW.storage = (function () {
  const K_CONFIG = 'sw_config';
  const K_RUNNING = 'sw_running';
  const K_CHANGE = 'sw_last_change';
  const K_EXPORT = 'sw_last_export';
  const LOG_PREFIX = 'sw_log_';

  const DEFAULTS = {
    schemaVersion: 1,
    dayTargets: { mon: 240, tue: 240, wed: 240, thu: 240, fri: 240, sat: 0, sun: 0 },
    categories: [
      { id: 'haushalt',  name: 'Haushalt',    color: '#f0b429', minMinutes: 30,  minPeriod: 'day',  active: true },
      { id: 'bewerbung', name: 'Bewerbungen', color: '#e8a317', minMinutes: 30,  minPeriod: 'day',  active: true },
      { id: 'verein',    name: 'Verein',      color: '#7aa2f7', minMinutes: 120, minPeriod: 'week', active: true },
      { id: 'umbau',     name: 'Umbau',       color: '#bb7af7', minMinutes: 120, minPeriod: 'week', active: true }
    ],
    reminderMinutes: 45,
    askAfterMinutes: 90,
    hardStopMinutes: 600,
    taunts: null
  };

  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const WRITE_ERROR = 'Speicher voll oder gesperrt — nichts gespeichert.';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function readJson(key, fallback) {
    const raw = readRaw(key);
    if (raw === null) return fallback;
    try {
      const v = JSON.parse(raw);
      return (v === null || v === undefined) ? fallback : v;
    } catch (e) { return fallback; }
  }

  // Jeder Schreibzugriff läuft hier durch: setItem kann werfen (Speicher voll,
  // Schreibzugriff gesperrt). Der Fehler wird nie verschluckt, und
  // sw_last_change wird nur bei Erfolg gesetzt.
  function writeKey(key, value, touchChange) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      return { ok: false, error: WRITE_ERROR };
    }
    if (touchChange !== false) {
      try { localStorage.setItem(K_CHANGE, new Date().toISOString()); } catch (e) { /* Hauptschreibung war erfolgreich */ }
    }
    return { ok: true };
  }

  function monthOf(dateStr) { return String(dateStr).slice(0, 7); }
  function logKey(ym) { return LOG_PREFIX + ym; }

  /* ── Config ─────────────────────────────────────────────────── */

  function loadConfig() {
    const stored = readJson(K_CONFIG, null);
    const cfg = clone(DEFAULTS);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      Object.keys(stored).forEach(k => {
        if (k === 'dayTargets' && stored[k] && typeof stored[k] === 'object') {
          cfg.dayTargets = Object.assign({}, DEFAULTS.dayTargets, stored[k]);
        } else if (stored[k] !== undefined) {
          cfg[k] = stored[k];
        }
      });
      if (!Array.isArray(cfg.categories)) cfg.categories = clone(DEFAULTS.categories);
    }
    return cfg;
  }

  // Jede Config, die hier hereinkommt, wird geprüft — egal ob aus dem
  // Formular, aus dem JSON-Feld oder aus einem Backup. Vorher konnten
  // Formular und Import sich darüber uneinig sein, was gültig ist, und das
  // Formular eine Config schreiben, die die Uhr lahmlegt (hardStopMinutes 0).
  function saveConfig(cfg) {
    const pruefung = validateBackup({ config: cfg });
    if (!pruefung.ok) return { ok: false, error: pruefung.errors.join(' '), errors: pruefung.errors };
    return writeKey(K_CONFIG, cfg);
  }

  /* ── Protokoll ──────────────────────────────────────────────── */

  function loadMonth(ym) {
    const m = readJson(logKey(ym), {});
    return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
  }

  function loadDay(dateStr) {
    const rec = loadMonth(monthOf(dateStr))[dateStr];
    return rec ? rec : null;
  }

  function saveDay(dateStr, rec) {
    const ym = monthOf(dateStr);
    const month = loadMonth(ym);
    month[dateStr] = rec;
    return writeKey(logKey(ym), month);
  }

  // Nimmt einen Tag wieder heraus — gebraucht fürs Zurückrollen einer
  // fehlgeschlagenen Buchung über die Tagesgrenze.
  function removeDay(dateStr) {
    const ym = monthOf(dateStr);
    const month = loadMonth(ym);
    if (!(dateStr in month)) return { ok: true };
    delete month[dateStr];
    return writeKey(logKey(ym), month);
  }

  function listMonths() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(LOG_PREFIX) === 0) out.push(k.slice(LOG_PREFIX.length));
      }
    } catch (e) { /* kein Zugriff → leere Liste */ }
    return out.sort();
  }

  /* ── laufender Eintrag ──────────────────────────────────────── */

  function loadRunning() {
    const r = readJson(K_RUNNING, null);
    return (r && typeof r === 'object') ? r : null;
  }

  function saveRunning(r) { return writeKey(K_RUNNING, r); }

  function clearRunning() {
    try { localStorage.removeItem(K_RUNNING); } catch (e) { /* nichts zu tun */ }
  }

  function lastChange() { return readRaw(K_CHANGE); }

  function lastExportAt() { return readRaw(K_EXPORT); }

  function markExported(iso) {
    try { localStorage.setItem(K_EXPORT, iso); } catch (e) { /* unkritisch */ }
  }

  /* ── Export / Import ────────────────────────────────────────── */

  function exportAll() {
    const logs = {};
    listMonths().forEach(ym => { logs[ym] = loadMonth(ym); });
    return {
      appVersion: (typeof APP_VERSION === 'string') ? APP_VERSION : '0',
      exportedAt: new Date().toISOString(),
      config: loadConfig(),
      logs: logs
    };
  }

  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function isStr(v) { return typeof v === 'string'; }

  // Prüft ein Backup vollständig durch und sammelt alle Fehler. Ein halb
  // importierter Zustand wäre schlimmer als gar keiner (Spec A4), deshalb
  // entscheidet erst das Gesamtergebnis über das Schreiben.
  function validateBackup(obj) {
    const errors = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errors: ['Backup ist kein Objekt.'] };
    }
    const cfg = obj.config;
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
      errors.push('config fehlt oder ist kein Objekt.');
    } else {
      if (cfg.dayTargets !== undefined) {
        if (!cfg.dayTargets || typeof cfg.dayTargets !== 'object' || Array.isArray(cfg.dayTargets)) {
          errors.push('config.dayTargets ist kein Objekt.');
        } else {
          Object.keys(cfg.dayTargets).forEach(k => {
            if (DAYS.indexOf(k) === -1) errors.push(`config.dayTargets.${k} ist kein Wochentag.`);
            else if (!isInt(cfg.dayTargets[k]) || cfg.dayTargets[k] < 0) errors.push(`config.dayTargets.${k} ist keine Minutenzahl.`);
          });
        }
      }
      if (cfg.categories !== undefined) {
        if (!Array.isArray(cfg.categories)) {
          errors.push('config.categories ist keine Liste.');
        } else {
          cfg.categories.forEach((c, i) => {
            if (!c || typeof c !== 'object') { errors.push(`config.categories[${i}] ist kein Objekt.`); return; }
            if (!isStr(c.id) || !c.id) errors.push(`config.categories[${i}].id fehlt.`);
            if (!isStr(c.name)) errors.push(`config.categories[${i}].name fehlt.`);
            if (!isInt(c.minMinutes) || c.minMinutes < 0) errors.push(`config.categories[${i}].minMinutes ist keine Minutenzahl.`);
            if (c.minPeriod !== 'day' && c.minPeriod !== 'week') errors.push(`config.categories[${i}].minPeriod muss day oder week sein.`);
          });
        }
      }
      ['reminderMinutes', 'askAfterMinutes', 'hardStopMinutes'].forEach(k => {
        if (cfg[k] !== undefined && (!isInt(cfg[k]) || cfg[k] <= 0)) errors.push(`config.${k} ist keine Minutenzahl.`);
      });
    }
    if (obj.logs !== undefined) {
      if (!obj.logs || typeof obj.logs !== 'object' || Array.isArray(obj.logs)) {
        errors.push('logs ist kein Objekt.');
      } else {
        Object.keys(obj.logs).forEach(ym => {
          if (!/^\d{4}-\d{2}$/.test(ym)) errors.push(`logs.${ym} ist kein Monat im Format YYYY-MM.`);
          const month = obj.logs[ym];
          if (!month || typeof month !== 'object' || Array.isArray(month)) { errors.push(`logs.${ym} ist kein Objekt.`); return; }
          Object.keys(month).forEach(d => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`logs.${ym}.${d} ist kein Datum im Format YYYY-MM-DD.`);
            const rec = month[d];
            if (!rec || typeof rec !== 'object') { errors.push(`logs.${ym}.${d} ist kein Objekt.`); return; }
            if (rec.target !== undefined && (!isInt(rec.target) || rec.target < 0)) {
              errors.push(`logs.${ym}.${d}.target ist keine Minutenzahl.`);
            }
            if (rec.mins !== undefined && (!rec.mins || typeof rec.mins !== 'object' || Array.isArray(rec.mins))) {
              errors.push(`logs.${ym}.${d}.mins ist kein Objekt.`);
            }
            if (!Array.isArray(rec.entries)) { errors.push(`logs.${ym}.${d}.entries ist keine Liste.`); return; }
            rec.entries.forEach((e, i) => {
              if (!e || typeof e !== 'object') { errors.push(`logs.${ym}.${d}.entries[${i}] ist kein Objekt.`); return; }
              if (!isStr(e.cat) || !e.cat) errors.push(`logs.${ym}.${d}.entries[${i}].cat fehlt.`);
              if (!isStr(e.start) || isNaN(new Date(e.start).getTime())) {
                errors.push(`logs.${ym}.${d}.entries[${i}].start ist kein Zeitstempel.`);
              }
              if (!isStr(e.end) || isNaN(new Date(e.end).getTime())) {
                errors.push(`logs.${ym}.${d}.entries[${i}].end ist kein Zeitstempel.`);
              }
            });
          });
        });
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  // Ein Backup einspielen heisst ersetzen, nicht mischen: Monate, die das
  // Backup nicht kennt, verschwinden — sonst tragen alte Reste weiter zu
  // Summen, Historie und Serie bei.
  //
  // Und es gilt ganz oder gar nicht: Vor der ersten Schreibung wird der
  // komplette alte Zustand gesichert; scheitert irgendetwas, wird er
  // zurückgespielt. Ein halb eingespieltes Backup wäre schlimmer als keines
  // (Spec A4).
  function importAll(obj) {
    const check = validateBackup(obj);
    if (!check.ok) return { ok: false, errors: check.errors };

    const sicherung = sicherungAllerSchluessel();
    const logs = obj.logs || {};
    const errors = [];

    listMonths().forEach(ym => {
      if (!(ym in logs)) {
        try { localStorage.removeItem(logKey(ym)); } catch (e) { errors.push(WRITE_ERROR); }
      }
    });

    if (errors.length === 0) {
      const res = saveConfig(obj.config);
      if (!res.ok) errors.push(res.error);
    }

    if (errors.length === 0) {
      Object.keys(logs).forEach(ym => {
        if (errors.length) return;
        const w = writeKey(logKey(ym), logs[ym]);
        if (!w.ok) errors.push(w.error);
      });
    }

    if (errors.length > 0) {
      sicherungZurueck(sicherung);
      return { ok: false, errors: errors };
    }

    // Ein laufender Eintrag stammt aus der Welt vor dem Import und gehört
    // nicht zu den eingespielten Daten.
    clearRunning();
    return { ok: true, errors: [] };
  }

  function eigeneSchluessel() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('sw_') === 0) keys.push(k);
      }
    } catch (e) { /* kein Zugriff */ }
    return keys;
  }

  function sicherungAllerSchluessel() {
    const stand = {};
    eigeneSchluessel().forEach(k => { stand[k] = readRaw(k); });
    return stand;
  }

  function sicherungZurueck(stand) {
    try {
      eigeneSchluessel().forEach(k => { if (!(k in stand)) localStorage.removeItem(k); });
      Object.keys(stand).forEach(k => {
        if (stand[k] !== null) localStorage.setItem(k, stand[k]);
      });
    } catch (e) { /* mehr als der Versuch ist nicht möglich */ }
  }

  return {
    DEFAULTS: DEFAULTS,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    loadDay: loadDay,
    saveDay: saveDay,
    removeDay: removeDay,
    loadMonth: loadMonth,
    listMonths: listMonths,
    loadRunning: loadRunning,
    saveRunning: saveRunning,
    clearRunning: clearRunning,
    lastChange: lastChange,
    lastExportAt: lastExportAt,
    markExported: markExported,
    exportAll: exportAll,
    validateBackup: validateBackup,
    importAll: importAll
  };
})();
