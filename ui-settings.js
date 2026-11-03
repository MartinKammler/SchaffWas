/* ui-settings.js — Einstellungen, Sicherung, JSON.
   Der Normalfall läuft über das Formular; wer will, bearbeitet das
   Config-JSON direkt (Spec §7.4). Geschrieben wird nur, was validiert ist. */
window.SW = window.SW || {};

SW.settings = (function () {

  const WOCHENTAGE = [
    ['mon', 'Montag'], ['tue', 'Dienstag'], ['wed', 'Mittwoch'], ['thu', 'Donnerstag'],
    ['fri', 'Freitag'], ['sat', 'Samstag'], ['sun', 'Sonntag']
  ];
  const FARBEN = ['#f0b429', '#e8a317', '#7aa2f7', '#bb7af7', '#38c172', '#e3342f', '#2dd4bf', '#f472b6'];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function wurzel() { return document.getElementById('screen-settings') || document.getElementById('buehne'); }

  function zahl(wert, ersatz) {
    const n = parseInt(wert, 10);
    return isNaN(n) ? ersatz : n;
  }

  function hatEintraege(catId) {
    return SW.storage.listMonths().some(ym => {
      const monat = SW.storage.loadMonth(ym);
      return Object.keys(monat).some(d =>
        (monat[d].entries || []).some(e => e.cat === catId));
    });
  }

  /* ── Formular ───────────────────────────────────────────────── */

  function katBlock(c) {
    const box = el('div', 'set-kat');
    box.dataset.id = c.id;

    const kopf = el('div', 'set-kat-kopf');
    const farbe = document.createElement('input');
    farbe.type = 'color'; farbe.name = 'cat-' + c.id + '-color'; farbe.value = c.color;
    kopf.appendChild(farbe);

    const name = document.createElement('input');
    name.type = 'text'; name.name = 'cat-' + c.id + '-name'; name.value = c.name;
    kopf.appendChild(name);
    box.appendChild(kopf);

    const zeile = el('div', 'set-kat-zeile');
    const min = document.createElement('input');
    min.type = 'number'; min.min = '0'; min.name = 'cat-' + c.id + '-min'; min.value = c.minMinutes;
    zeile.appendChild(min);
    zeile.appendChild(el('span', 'einheit', 'min'));

    const periode = document.createElement('select');
    periode.name = 'cat-' + c.id + '-period';
    [['day', 'pro Tag'], ['week', 'pro Woche']].forEach(([w, l]) => {
      const o = document.createElement('option');
      o.value = w; o.textContent = l;
      periode.appendChild(o);
    });
    periode.value = c.minPeriod;
    zeile.appendChild(periode);
    box.appendChild(zeile);

    const fuss = el('div', 'set-kat-fuss');
    const aktivLabel = el('label', 'schalter');
    const aktiv = document.createElement('input');
    aktiv.type = 'checkbox'; aktiv.name = 'cat-' + c.id + '-active'; aktiv.checked = c.active !== false;
    aktivLabel.appendChild(aktiv);
    aktivLabel.appendChild(el('span', null, 'aktiv'));
    fuss.appendChild(aktivLabel);

    const weg = el('button', 'gefahr klein', 'Entfernen');
    weg.name = 'cat-' + c.id + '-delete';
    weg.addEventListener('click', function () {
      const config = collect(wurzel());
      if (hatEintraege(c.id)) {
        const kat = config.categories.filter(x => x.id === c.id)[0];
        if (kat) kat.active = false;
        const res = SW.storage.saveConfig(config);
        render(wurzel(), SW.storage.loadConfig(),
          res.ok ? 'Kategorie stillgelegt — Historie bleibt erhalten.' : res.error);
        return;
      }
      config.categories = config.categories.filter(x => x.id !== c.id);
      const res = SW.storage.saveConfig(config);
      render(wurzel(), SW.storage.loadConfig(), res.ok ? 'Kategorie entfernt.' : res.error);
    });
    fuss.appendChild(weg);
    box.appendChild(fuss);

    return box;
  }

  function render(root, config, hinweis) {
    root.innerHTML = '';

    // Der Schriftzug darf hier groß stehen — hier ist Platz (Spec §8).
    const schriftzug = document.createElement('img');
    schriftzug.className = 'set-schriftzug';
    schriftzug.src = './Logo-Schriftzug.png';
    schriftzug.alt = 'Schaff was!';
    root.appendChild(schriftzug);

    root.appendChild(el('h2', null, 'Einstellungen'));
    if (hinweis) root.appendChild(el('p', 'set-hinweis', hinweis));

    /* Kategorien */
    root.appendChild(el('h3', null, 'Kategorien'));
    const kats = el('div', 'set-kats');
    (config.categories || []).forEach(c => kats.appendChild(katBlock(c)));
    root.appendChild(kats);

    const neu = el('div', 'set-neu');
    const neuName = document.createElement('input');
    neuName.type = 'text'; neuName.name = 'cat-neu-name'; neuName.placeholder = 'Neue Kategorie';
    neu.appendChild(neuName);
    const neuKnopf = el('button', 'primaer', 'Anlegen');
    neuKnopf.name = 'cat-neu';
    neuKnopf.addEventListener('click', function () {
      const name = neuName.value.trim();
      if (!name) return;
      const aktuell = collect(root);
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('kat' + Date.now());
      if (aktuell.categories.some(c => c.id === id)) {
        render(root, aktuell, 'Es gibt schon eine Kategorie mit diesem Namen.');
        return;
      }
      aktuell.categories.push({
        id: id, name: name,
        color: FARBEN[aktuell.categories.length % FARBEN.length],
        minMinutes: 30, minPeriod: 'day', active: true
      });
      const res = SW.storage.saveConfig(aktuell);
      render(root, SW.storage.loadConfig(), res.ok ? 'Kategorie angelegt.' : res.error);
    });
    neu.appendChild(neuKnopf);
    root.appendChild(neu);

    /* Tagessoll */
    root.appendChild(el('h3', null, 'Tagessoll je Wochentag'));
    const ziele = el('div', 'set-ziele');
    WOCHENTAGE.forEach(([key, label]) => {
      const z = el('label', 'set-ziel');
      z.appendChild(el('span', null, label));
      const i = document.createElement('input');
      i.type = 'number'; i.min = '0'; i.name = 'target-' + key;
      i.value = (config.dayTargets || {})[key];
      z.appendChild(i);
      z.appendChild(el('span', 'einheit', 'min'));
      ziele.appendChild(z);
    });
    root.appendChild(ziele);

    /* Uhr-Verhalten */
    root.appendChild(el('h3', null, 'Uhr'));
    const uhr = el('div', 'set-ziele');
    [
      ['reminderMinutes', 'Erinnerung nach'],
      ['askAfterMinutes', 'Rückfrage nach unbeachteter Zeit'],
      ['hardStopMinutes', 'Harte Obergrenze']
    ].forEach(([key, label]) => {
      const z = el('label', 'set-ziel');
      z.appendChild(el('span', null, label));
      const i = document.createElement('input');
      i.type = 'number'; i.min = '1'; i.name = key; i.value = config[key];
      z.appendChild(i);
      z.appendChild(el('span', 'einheit', 'min'));
      uhr.appendChild(z);
    });
    root.appendChild(uhr);
    root.appendChild(el('p', 'set-fussnote',
      'Die Erinnerung erscheint nur, solange die App offen ist. Benachrichtigungen im Hintergrund gibt es ohne Server nicht.'));

    const speichern = el('button', 'primaer breit', 'Speichern');
    speichern.name = 'speichern';
    speichern.addEventListener('click', function () {
      const res = SW.storage.saveConfig(collect(root));
      render(root, SW.storage.loadConfig(), res.ok ? 'Gespeichert.' : res.error);
    });
    root.appendChild(speichern);

    /* Sicherung */
    root.appendChild(el('h3', null, 'Sicherung'));
    const stand = el('p', 'export-stand', exportStand(new Date()));
    root.appendChild(stand);

    const exportKnopf = el('button', null, 'Backup herunterladen');
    exportKnopf.name = 'export';
    exportKnopf.addEventListener('click', function () {
      downloadBackup(new Date());
      stand.textContent = exportStand(new Date());
    });
    root.appendChild(exportKnopf);

    const importFeld = document.createElement('input');
    importFeld.type = 'file'; importFeld.accept = 'application/json'; importFeld.name = 'import';
    importFeld.addEventListener('change', function () {
      const datei = importFeld.files && importFeld.files[0];
      if (!datei) return;
      const leser = new FileReader();
      leser.onload = function () {
        // Ein Backup ersetzt den gesamten Bestand. Vorher wird gefragt, und
        // zwar mit den Zahlen, an denen man die falsche Datei erkennt
        // (Spec §7.4, A4).
        bestaetigeImport(String(leser.result), function (res) {
          render(root, SW.storage.loadConfig(),
            res === null ? 'Import abgebrochen.'
              : res.ok ? 'Backup eingespielt.'
                : ('Import abgelehnt: ' + res.errors.join(' ')));
        });
      };
      leser.readAsText(datei);
      importFeld.value = '';
    });
    root.appendChild(importFeld);

    const speicherStand = el('p', 'set-fussnote', 'Speicher: wird geprüft …');
    root.appendChild(speicherStand);
    requestPersist().then(s => { speicherStand.textContent = 'Speicher: ' + s; });

    /* JSON */
    root.appendChild(el('h3', null, 'Konfiguration als JSON'));
    const json = document.createElement('textarea');
    json.name = 'json'; json.rows = 10;
    json.value = JSON.stringify(config, null, 2);
    root.appendChild(json);
    const jsonFehler = el('p', 'json-fehler');
    root.appendChild(jsonFehler);
    const jsonKnopf = el('button', null, 'JSON übernehmen');
    jsonKnopf.name = 'json-uebernehmen';
    jsonKnopf.addEventListener('click', function () {
      const res = applyJsonText(json.value);
      if (!res.ok) { jsonFehler.textContent = res.errors.join(' '); return; }
      render(root, SW.storage.loadConfig(), 'JSON übernommen.');
    });
    root.appendChild(jsonKnopf);

    root.appendChild(el('p', 'set-version', 'Schaff was! Version ' + (typeof APP_VERSION === 'string' ? APP_VERSION : '?')));
  }

  function collect(root) {
    const vorlage = SW.storage.loadConfig();
    const categories = [];
    root.querySelectorAll('.set-kat').forEach(box => {
      const id = box.dataset.id;
      const alt = (vorlage.categories || []).filter(c => c.id === id)[0] || {};
      categories.push({
        id: id,
        name: root.querySelector('[name="cat-' + id + '-name"]').value,
        color: root.querySelector('[name="cat-' + id + '-color"]').value,
        minMinutes: zahl(root.querySelector('[name="cat-' + id + '-min"]').value, alt.minMinutes || 0),
        minPeriod: root.querySelector('[name="cat-' + id + '-period"]').value,
        active: root.querySelector('[name="cat-' + id + '-active"]').checked
      });
    });

    const dayTargets = {};
    WOCHENTAGE.forEach(([key]) => {
      dayTargets[key] = zahl(root.querySelector('[name="target-' + key + '"]').value, 0);
    });

    return {
      schemaVersion: vorlage.schemaVersion,
      dayTargets: dayTargets,
      categories: categories,
      reminderMinutes: zahl(root.querySelector('[name="reminderMinutes"]').value, vorlage.reminderMinutes),
      askAfterMinutes: zahl(root.querySelector('[name="askAfterMinutes"]').value, vorlage.askAfterMinutes),
      hardStopMinutes: zahl(root.querySelector('[name="hardStopMinutes"]').value, vorlage.hardStopMinutes),
      taunts: vorlage.taunts
    };
  }

  /* ── JSON und Sicherung ─────────────────────────────────────── */

  function applyJsonText(text) {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, errors: ['Kein gültiges JSON: ' + e.message] }; }
    const pruefung = SW.storage.validateBackup({ config: obj });
    if (!pruefung.ok) return { ok: false, errors: pruefung.errors };
    const res = SW.storage.saveConfig(obj);
    return res.ok ? { ok: true, errors: [] } : { ok: false, errors: [res.error] };
  }

  function applyBackupText(text) {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, errors: ['Kein gültiges JSON: ' + e.message] }; }
    return SW.storage.importAll(obj);
  }

  // Zeigt, was das Backup enthält und was es ersetzt, und führt den Import
  // erst nach einer ausdrücklichen Bestätigung aus.
  function bestaetigeImport(text, fertig) {
    let obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (!obj) { fertig({ ok: false, errors: ['Kein gültiges JSON.'] }); return; }

    const monate = obj.logs ? Object.keys(obj.logs).length : 0;
    const tage = obj.logs
      ? Object.keys(obj.logs).reduce((a, ym) => a + Object.keys(obj.logs[ym] || {}).length, 0)
      : 0;
    const eigeneMonate = SW.storage.listMonths().length;

    const backdrop = el('div', 'ask-backdrop');
    const box = el('div', 'ask');
    box.appendChild(el('p', 'ask-frage', 'Backup einspielen?'));
    box.appendChild(el('p', 'ask-text',
      `Die Datei bringt ${tage} Tage aus ${monate} Monaten` +
      (obj.exportedAt ? `, gesichert am ${SW.model.dateKeyOf(obj.exportedAt)}` : '') + '. ' +
      `Deine jetzigen Daten aus ${eigeneMonate} Monaten werden dabei vollständig ersetzt. ` +
      'Das lässt sich nicht rückgängig machen.'));

    const ja = el('button', null, 'Ja, alles ersetzen');
    ja.name = 'import-bestaetigen';
    ja.addEventListener('click', function () {
      backdrop.remove();
      fertig(applyBackupText(text));
    });
    box.appendChild(ja);

    const nein = el('button', null, 'Abbrechen');
    nein.name = 'import-abbrechen';
    nein.addEventListener('click', function () { backdrop.remove(); fertig(null); });
    box.appendChild(nein);

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    return box;
  }

  function backupFile(now) {
    const d = SW.model.dateKeyOf(now);
    return { name: 'schaffwas-backup-' + d + '.json', json: JSON.stringify(SW.storage.exportAll(), null, 2) };
  }

  function downloadBackup(now) {
    const datei = backupFile(now);
    try {
      const blob = new Blob([datei.json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = datei.name;
      // Manche Browser ignorieren einen Klick auf ein Element, das nicht im
      // Dokument hängt, und brechen den Download ab, wenn die Blob-URL zu
      // früh freigegeben wird.
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    } catch (e) {
      // Kein Download zustande gekommen: dann wird auch nicht behauptet, es
      // gäbe eine Sicherung.
      return Object.assign({}, datei, { ok: false });
    }
    SW.storage.markExported(SW.model.toLocalIso(now));
    return Object.assign({}, datei, { ok: true });
  }

  function exportStand(now) {
    const letzter = SW.storage.lastExportAt();
    if (!letzter) return 'Letzter Export: noch nie. Ohne Backup ist alles weg, wenn du die Browserdaten löschst.';
    const tage = Math.floor((now.getTime() - new Date(letzter).getTime()) / 86400000);
    if (tage <= 0) return 'Letzter Export: heute.';
    return 'Letzter Export: vor ' + tage + (tage === 1 ? ' Tag.' : ' Tagen.');
  }

  function requestPersist() {
    try {
      if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
        return Promise.resolve('unbekannt');
      }
      return navigator.storage.persist()
        .then(ok => ok ? 'dauerhaft' : 'nicht garantiert')
        .catch(() => 'unbekannt');
    } catch (e) {
      return Promise.resolve('unbekannt');
    }
  }

  function refresh() { render(wurzel(), SW.storage.loadConfig()); }

  return {
    render: render,
    collect: collect,
    applyJsonText: applyJsonText,
    applyBackupText: applyBackupText,
    backupFile: backupFile,
    bestaetigeImport: bestaetigeImport,
    downloadBackup: downloadBackup,
    exportStand: exportStand,
    requestPersist: requestPersist,
    refresh: refresh
  };
})();
