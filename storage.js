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
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* ── Grenzwerte der Prüfung (Befund S1) ─────────────────────────
     Alle Grenzen sind bewusst so weit gesetzt, dass kein realistischer
     Bestand an ihnen scheitert; sie fangen nur Unsinn ab, der aus einer
     fremden oder von Hand verbogenen Datei kommt. */

  const SCHEMA_VERSION = 1;              // aktuelles Format (Spec §7.1)
  const MAX_TEXT = 200;                  // Namen, IDs, Farben: länger ist kein Name, sondern eine Nutzlast
  const MAX_TAG_MINUTEN = 24 * 60;       // ein Tagessoll über 24 h ist unerfüllbar
  const MAX_WOCHE_MINUTEN = 7 * 24 * 60; // ein Wochenminimum über 7 Tagen ebenso
  const MAX_KATEGORIEN = 50;             // Martin hat vier; 50 ist weit jenseits des Sinnvollen
  const MAX_MONATE = 1200;               // 100 Jahre Protokoll
  const MAX_TAGE_JE_MONAT = 31;          // mehr Tage hat kein Monat
  const MAX_EINTRAEGE_JE_TAG = 500;      // ein Stempel je drei Minuten, 24 h lang
  const MAX_EINTRAEGE_GESAMT = 100000;   // Obergrenze für die Prüfung selbst: sie läuft im UI-Thread
  const MAX_FEHLER = 100;                // mehr liest niemand, und die Liste soll nicht selbst zur Last werden
  const MAX_WARNUNGEN = 50;

  const BACKUP_FELDER = ['schemaVersion', 'appVersion', 'exportedAt', 'config', 'logs'];
  const CONFIG_FELDER = ['schemaVersion', 'dayTargets', 'categories', 'reminderMinutes',
    'askAfterMinutes', 'hardStopMinutes', 'taunts'];
  const KATEGORIE_FELDER = ['id', 'name', 'color', 'minMinutes', 'minPeriod', 'active'];
  const TAG_FELDER = ['target', 'mins', 'entries'];
  const EINTRAG_FELDER = ['id', 'cat', 'start', 'end', 'src'];
  const SRC_WERTE = ['timer', 'manual', 'autostop', 'trimmed'];

  // Sammelstelle für Fehler und Warnungen. Gezählt wird mit, was über die
  // Obergrenze hinaus anfällt — unterdrückte Fehler werden genannt, nicht
  // verschwiegen.
  function sammler() {
    const errors = [];
    const warnings = [];
    let zuviel = 0;
    return {
      fehler: function (t) { if (errors.length < MAX_FEHLER) errors.push(t); else zuviel++; },
      warnung: function (t) { if (warnings.length < MAX_WARNUNGEN) warnings.push(t); },
      ergebnis: function () {
        if (zuviel > 0) errors.push(`Dazu kommen ${zuviel} weitere Fehler, die hier nicht mehr aufgeführt sind.`);
        return { ok: errors.length === 0, errors: errors, warnings: warnings };
      }
    };
  }

  // Tagesschlüssel eines Zeitpunkts in lokaler Zeit — dieselbe Rechnung wie
  // SW.model.dateKeyOf.
  //
  // Bewusst hier noch einmal und nicht über SW.model: storage.js ist die
  // Speicherschicht und wird in Tests auch allein geladen (tests/test_storage.html
  // zieht nur version.js und storage.js). Eine Abfrage auf Vorhandensein von
  // SW.model hätte zwei Prüfpfade zur Folge — die Validierung würde je nach
  // Ladereihenfolge anders urteilen, und genau das darf eine Prüfung nicht.
  // Der Preis sind drei kurze Hilfsfunktionen; die Rechnung ist trivial und
  // steht in model.js unverändert daneben.
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function tagesschluessel(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function folgetag(dateStr) {
    const t = String(dateStr).split('-');
    // Mittags gerechnet, damit die Sommerzeit-Umstellung nicht in den
    // Vortag zurückfällt.
    const d = new Date(Number(t[0]), Number(t[1]) - 1, Number(t[2]) + 1, 12, 0, 0, 0);
    return tagesschluessel(d);
  }

  function istMitternacht(d) {
    return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
  }

  function zeitpunkt(v) {
    if (!isStr(v)) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // Unbekannte Felder werden nicht abgelehnt, sondern als Warnung gemeldet.
  // Begründung: ein künftiges Format darf ein Feld ergänzen, ohne dass alte
  // Installationen das Backup verweigern — eine harte Ablehnung würde die
  // Sicherung ausgerechnet dann unbrauchbar machen, wenn sie gebraucht wird.
  // Stillschweigend übergehen wäre aber auch falsch: wer eine Datei von Hand
  // bearbeitet und sich vertippt ("dayTarget" statt "dayTargets"), soll das
  // erfahren. Deshalb: ok bleibt true, warnings nennt jedes Feld mit Pfad.
  function unbekannteFelder(objekt, bekannt, pfad, f) {
    Object.keys(objekt).forEach(k => {
      if (bekannt.indexOf(k) === -1) {
        f.warnung(`${pfad}.${k} ist ein unbekanntes Feld und wird nicht geprüft.`);
      }
    });
  }

  function textPruefen(wert, pfad, f) {
    if (isStr(wert) && wert.length > MAX_TEXT) {
      f.fehler(`${pfad} ist mit ${wert.length} Zeichen zu lang — höchstens ${MAX_TEXT} Zeichen sind erlaubt.`);
      return false;
    }
    return true;
  }

  function obergrenzePruefen(wert, pfad, max, f) {
    if (isInt(wert) && wert > max) {
      f.fehler(`${pfad} ist mit ${wert} Minuten unmöglich — höchstens ${max} Minuten sind erlaubt.`);
      return false;
    }
    return true;
  }

  function configPruefen(cfg, f) {
    unbekannteFelder(cfg, CONFIG_FELDER, 'config', f);

    if (cfg.schemaVersion !== undefined) {
      if (!isInt(cfg.schemaVersion) || cfg.schemaVersion < 1) {
        f.fehler('config.schemaVersion ist keine Versionsnummer.');
      } else if (cfg.schemaVersion > SCHEMA_VERSION) {
        f.fehler(`config.schemaVersion ${cfg.schemaVersion} stammt aus einer neueren Version von Schaff was! `
          + `— diese Version versteht höchstens ${SCHEMA_VERSION} und spielt das Backup nicht ein.`);
      }
    }

    if (cfg.dayTargets !== undefined) {
      if (!isObj(cfg.dayTargets)) {
        f.fehler('config.dayTargets ist kein Objekt.');
      } else {
        Object.keys(cfg.dayTargets).forEach(k => {
          if (DAYS.indexOf(k) === -1) f.fehler(`config.dayTargets.${k} ist kein Wochentag.`);
          else if (!isInt(cfg.dayTargets[k]) || cfg.dayTargets[k] < 0) f.fehler(`config.dayTargets.${k} ist keine Minutenzahl.`);
          else obergrenzePruefen(cfg.dayTargets[k], `config.dayTargets.${k}`, MAX_TAG_MINUTEN, f);
        });
      }
    }

    if (cfg.categories !== undefined) {
      if (!Array.isArray(cfg.categories)) {
        f.fehler('config.categories ist keine Liste.');
      } else if (cfg.categories.length > MAX_KATEGORIEN) {
        f.fehler(`config.categories enthält ${cfg.categories.length} Kategorien — höchstens ${MAX_KATEGORIEN} sind erlaubt.`);
      } else {
        const gesehen = {};
        cfg.categories.forEach((c, i) => {
          const pfad = `config.categories[${i}]`;
          if (!isObj(c)) { f.fehler(`${pfad} ist kein Objekt.`); return; }
          unbekannteFelder(c, KATEGORIE_FELDER, pfad, f);

          if (!isStr(c.id) || !c.id) {
            f.fehler(`${pfad}.id fehlt.`);
          } else if (textPruefen(c.id, `${pfad}.id`, f)) {
            // Doppelte IDs machen Historie und Minima unauflösbar: die Summen
            // einer Kategorie würden auf zwei Einträge in der Config zeigen.
            if (gesehen[c.id]) f.fehler(`${pfad}.id "${c.id}" kommt in config.categories mehrfach vor.`);
            gesehen[c.id] = true;
          }

          if (!isStr(c.name)) f.fehler(`${pfad}.name fehlt.`);
          else textPruefen(c.name, `${pfad}.name`, f);
          if (c.color !== undefined) {
            if (!isStr(c.color)) f.fehler(`${pfad}.color ist keine Farbe.`);
            else textPruefen(c.color, `${pfad}.color`, f);
          }
          if (c.active !== undefined && typeof c.active !== 'boolean') {
            f.fehler(`${pfad}.active ist kein Ja/Nein-Wert.`);
          }

          const wochenweise = c.minPeriod === 'week';
          if (c.minPeriod !== 'day' && !wochenweise) f.fehler(`${pfad}.minPeriod muss day oder week sein.`);
          if (!isInt(c.minMinutes) || c.minMinutes < 0) f.fehler(`${pfad}.minMinutes ist keine Minutenzahl.`);
          else obergrenzePruefen(c.minMinutes, `${pfad}.minMinutes`,
            wochenweise ? MAX_WOCHE_MINUTEN : MAX_TAG_MINUTEN, f);
        });
      }
    }

    // Die drei Uhr-Zeiten sind Zeiten innerhalb eines Stempelvorgangs; über
    // einen Kalendertag hinaus ergibt keine von ihnen noch einen Sinn.
    ['reminderMinutes', 'askAfterMinutes', 'hardStopMinutes'].forEach(k => {
      if (cfg[k] === undefined) return;
      if (!isInt(cfg[k]) || cfg[k] <= 0) f.fehler(`config.${k} ist keine Minutenzahl.`);
      else obergrenzePruefen(cfg[k], `config.${k}`, MAX_TAG_MINUTEN, f);
    });

    if (cfg.taunts !== undefined && cfg.taunts !== null && !isObj(cfg.taunts)) {
      f.fehler('config.taunts ist weder null noch ein Objekt.');
    }
  }

  // Prüft die Einträge eines Tages: Dauer, Zugehörigkeit zum Tag, eindeutige
  // IDs und Überschneidungen.
  function eintraegePruefen(entries, ym, d, tagBekannt, f) {
    const pfadTag = `logs.${ym}.${d}`;
    const gesehen = {};
    const spanne = [];   // nur die Einträge, deren Zeiten brauchbar sind

    entries.forEach((e, i) => {
      const pfad = `${pfadTag}.entries[${i}]`;
      if (!isObj(e)) { f.fehler(`${pfad} ist kein Objekt.`); return; }
      unbekannteFelder(e, EINTRAG_FELDER, pfad, f);

      if (!isStr(e.id) || !e.id) {
        f.fehler(`${pfad}.id fehlt.`);
      } else if (textPruefen(e.id, `${pfad}.id`, f)) {
        // Zwei Einträge mit derselben id an einem Tag: Bearbeiten und Löschen
        // greifen über die id zu und würden den falschen treffen.
        if (gesehen[e.id]) f.fehler(`${pfad}.id "${e.id}" kommt an diesem Tag mehrfach vor.`);
        gesehen[e.id] = true;
      }

      if (!isStr(e.cat) || !e.cat) f.fehler(`${pfad}.cat fehlt.`);
      else textPruefen(e.cat, `${pfad}.cat`, f);

      if (e.src !== undefined) {
        if (!isStr(e.src)) f.fehler(`${pfad}.src ist keine Herkunft.`);
        else if (SRC_WERTE.indexOf(e.src) === -1) {
          f.warnung(`${pfad}.src "${e.src}" ist keine bekannte Herkunft (${SRC_WERTE.join(', ')}).`);
        }
      }

      const start = zeitpunkt(e.start);
      const ende = zeitpunkt(e.end);
      if (!start) f.fehler(`${pfad}.start ist kein Zeitstempel.`);
      if (!ende) f.fehler(`${pfad}.end ist kein Zeitstempel.`);
      if (!start || !ende) return;

      if (ende.getTime() <= start.getTime()) {
        f.fehler(`${pfad}.end liegt nicht nach .start — die Dauer wäre null oder negativ.`);
        return;
      }

      if (tagBekannt) {
        // Der Eintrag muss in dem Tag stehen, zu dem er gehört: sonst zählt er
        // in Tagessumme, Serie und Historie am falschen Tag mit.
        const startTag = tagesschluessel(start);
        if (startTag !== d) {
          f.fehler(`${pfad}.start gehört zum ${startTag}, steht aber im Tagesdatensatz ${d}.`);
          return;
        }
        // Das Ende darf höchstens auf der Mitternacht des Folgetages liegen —
        // genau so legt clock.js den ersten Teil eines zerlegten Eintrags ab.
        const endeTag = tagesschluessel(ende);
        if (endeTag !== d && !(endeTag === folgetag(d) && istMitternacht(ende))) {
          f.fehler(`${pfad}.end liegt mit ${endeTag} außerhalb des Tages ${d} `
            + '— ein Eintrag endet spätestens an der folgenden Mitternacht.');
          return;
        }
      }

      spanne.push({ i: i, von: start.getTime(), bis: ende.getTime() });
    });

    // Überschneidungen: nach Beginn sortiert genügt der Vergleich mit dem
    // bisher weitesten Ende — das findet jede Überschneidung und bleibt auch
    // bei vielen Einträgen bezahlbar. Berührung an den Rändern ist erlaubt,
    // genau wie in SW.model.overlapOf.
    spanne.sort((a, b) => a.von - b.von);
    let weitestes = null;
    spanne.forEach(cur => {
      if (weitestes && cur.von < weitestes.bis) {
        f.fehler(`${pfadTag}.entries[${cur.i}] überschneidet sich zeitlich mit ${pfadTag}.entries[${weitestes.i}].`);
      }
      if (!weitestes || cur.bis > weitestes.bis) weitestes = cur;
    });
  }

  function logsPruefen(logs, f) {
    const monate = Object.keys(logs);
    if (monate.length > MAX_MONATE) {
      f.fehler(`logs enthält ${monate.length} Monate — höchstens ${MAX_MONATE} sind erlaubt.`);
      return;
    }

    let eintraegeGesamt = 0;
    let budgetGemeldet = false;

    monate.forEach(ym => {
      if (budgetGemeldet) return;
      if (!/^\d{4}-\d{2}$/.test(ym)) f.fehler(`logs.${ym} ist kein Monat im Format YYYY-MM.`);
      const month = logs[ym];
      if (!isObj(month)) { f.fehler(`logs.${ym} ist kein Objekt.`); return; }

      const tage = Object.keys(month);
      if (tage.length > MAX_TAGE_JE_MONAT) {
        f.fehler(`logs.${ym} enthält ${tage.length} Tage — ein Monat hat höchstens ${MAX_TAGE_JE_MONAT}.`);
        return;
      }

      tage.forEach(d => {
        if (budgetGemeldet) return;
        let tagBekannt = true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          f.fehler(`logs.${ym}.${d} ist kein Datum im Format YYYY-MM-DD.`);
          tagBekannt = false;
        } else if (monthOf(d) !== ym) {
          f.fehler(`logs.${ym}.${d} gehört nicht zum Monat ${ym}.`);
          tagBekannt = false;
        }

        const rec = month[d];
        if (!isObj(rec)) { f.fehler(`logs.${ym}.${d} ist kein Objekt.`); return; }
        unbekannteFelder(rec, TAG_FELDER, `logs.${ym}.${d}`, f);

        if (rec.target !== undefined) {
          if (!isInt(rec.target) || rec.target < 0) f.fehler(`logs.${ym}.${d}.target ist keine Minutenzahl.`);
          else obergrenzePruefen(rec.target, `logs.${ym}.${d}.target`, MAX_TAG_MINUTEN, f);
        }

        if (rec.mins !== undefined) {
          if (!isObj(rec.mins)) {
            f.fehler(`logs.${ym}.${d}.mins ist kein Objekt.`);
          } else {
            Object.keys(rec.mins).forEach(cat => {
              const pfad = `logs.${ym}.${d}.mins.${cat}`;
              const regel = rec.mins[cat];
              if (!Array.isArray(regel) || regel.length !== 2) {
                f.fehler(`${pfad} ist keine Regel aus Minutenzahl und Zeitraum.`);
                return;
              }
              const wochenweise = regel[1] === 'week';
              if (regel[1] !== 'day' && !wochenweise) f.fehler(`${pfad}[1] muss day oder week sein.`);
              if (!isInt(regel[0]) || regel[0] < 0) f.fehler(`${pfad}[0] ist keine Minutenzahl.`);
              else obergrenzePruefen(regel[0], `${pfad}[0]`, wochenweise ? MAX_WOCHE_MINUTEN : MAX_TAG_MINUTEN, f);
            });
          }
        }

        if (!Array.isArray(rec.entries)) { f.fehler(`logs.${ym}.${d}.entries ist keine Liste.`); return; }
        if (rec.entries.length > MAX_EINTRAEGE_JE_TAG) {
          f.fehler(`logs.${ym}.${d}.entries enthält ${rec.entries.length} Einträge — höchstens ${MAX_EINTRAEGE_JE_TAG} sind erlaubt.`);
          return;
        }

        eintraegeGesamt += rec.entries.length;
        if (eintraegeGesamt > MAX_EINTRAEGE_GESAMT) {
          f.fehler(`Das Backup enthält mehr als ${MAX_EINTRAEGE_GESAMT} Einträge — es wird nicht weiter geprüft und nicht eingespielt.`);
          budgetGemeldet = true;
          return;
        }

        eintraegePruefen(rec.entries, ym, d, tagBekannt, f);
      });
    });
  }

  // Prüft ein Backup vollständig durch und sammelt alle Fehler. Ein halb
  // importierter Zustand wäre schlimmer als gar keiner (Spec A4), deshalb
  // entscheidet erst das Gesamtergebnis über das Schreiben.
  //
  // Neben den Grundtypen werden die inhaltlichen Invarianten geprüft (Befund
  // S1): positive Dauer, keine Überschneidungen, eindeutige IDs, Eintrag im
  // passenden Tag, Zahlen in einer Größe, die es wirklich geben kann, und
  // Datenmengen in einer Größe, die diese Prüfung auch überlebt.
  //
  // warnings sind Hinweise, die ein Backup nicht ablehnen: ok hängt
  // ausschließlich an errors.
  function validateBackup(obj) {
    const f = sammler();
    if (!isObj(obj)) {
      return { ok: false, errors: ['Backup ist kein Objekt.'], warnings: [] };
    }
    unbekannteFelder(obj, BACKUP_FELDER, 'Backup', f);

    if (obj.schemaVersion !== undefined) {
      if (!isInt(obj.schemaVersion) || obj.schemaVersion < 1) {
        f.fehler('schemaVersion ist keine Versionsnummer.');
      } else if (obj.schemaVersion > SCHEMA_VERSION) {
        f.fehler(`schemaVersion ${obj.schemaVersion} stammt aus einer neueren Version von Schaff was! `
          + `— diese Version versteht höchstens ${SCHEMA_VERSION} und spielt das Backup nicht ein.`);
      }
    }
    if (obj.appVersion !== undefined) textPruefen(obj.appVersion, 'appVersion', f);
    if (obj.exportedAt !== undefined && !zeitpunkt(obj.exportedAt)) {
      f.warnung('exportedAt ist kein Zeitstempel — der Zeitpunkt der Sicherung bleibt unbekannt.');
    }

    if (!isObj(obj.config)) f.fehler('config fehlt oder ist kein Objekt.');
    else configPruefen(obj.config, f);

    if (obj.logs !== undefined) {
      if (!isObj(obj.logs)) f.fehler('logs ist kein Objekt.');
      else logsPruefen(obj.logs, f);
    }

    return f.ergebnis();
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
      if (!sicherungZurueck(sicherung)) {
        errors.push('Achtung: Der vorherige Stand konnte nicht vollständig wiederhergestellt werden. '
          + 'Schaff dir Platz und spiel ein Backup ein, bevor du weiterstempelst.');
      }
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

  // Gibt zurück, ob der alte Zustand wirklich wiederhergestellt wurde. Ein
  // stumm gescheiterter Rollback ist der schlimmste Fall überhaupt: dann ist
  // weder das Alte noch das Neue vollständig da, und niemand weiß davon.
  function sicherungZurueck(stand) {
    let ok = true;
    try {
      eigeneSchluessel().forEach(k => {
        if (!(k in stand)) {
          try { localStorage.removeItem(k); } catch (e) { ok = false; }
        }
      });
    } catch (e) { ok = false; }
    Object.keys(stand).forEach(k => {
      if (stand[k] === null) return;
      try { localStorage.setItem(k, stand[k]); } catch (e) { ok = false; }
    });
    return ok;
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
