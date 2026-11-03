/* ui-log.js — Tagesprotokoll: ansehen, korrigieren, nachtragen, löschen.
   Hier landet alles, was die Uhr falsch mitbekommen hat (Spec §6.4.3). */
window.SW = window.SW || {};

SW.log = (function () {

  const SRC_LABEL = {
    timer: '',
    manual: 'nachgetragen',
    trimmed: 'gekürzt',
    autostop: 'automatisch gestoppt'
  };

  const UNBEKANNT = { name: 'Unbekannt', color: '#6b7280' };

  let aktuellerTag = null;

  function katOf(catId, config) {
    const c = (config.categories || []).filter(x => x.id === catId)[0];
    return c || UNBEKANNT;
  }

  function model(dateKey, dayRec, config) {
    const entries = (dayRec && Array.isArray(dayRec.entries)) ? dayRec.entries.slice() : [];
    entries.sort((a, b) => new Date(a.start) - new Date(b.start));
    const rows = entries.map(e => {
      const k = katOf(e.cat, config);
      return {
        id: e.id,
        cat: e.cat,
        name: k.name,
        color: k.color,
        from: SW.ui.fmtTime(e.start),
        to: SW.ui.fmtTime(e.end),
        minutes: SW.model.entryMinutes(e),
        src: e.src || 'timer',
        srcLabel: SRC_LABEL[e.src] !== undefined ? SRC_LABEL[e.src] : ''
      };
    });
    return {
      dateKey: dateKey,
      rows: rows,
      total: rows.reduce((a, r) => a + r.minutes, 0)
    };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function wurzel() { return document.getElementById('screen-log') || document.getElementById('buehne'); }

  function neuZeichnen(dateKey) {
    const root = wurzel();
    if (root) render(root, model(dateKey, SW.storage.loadDay(dateKey), SW.storage.loadConfig()));
  }

  function render(root, m) {
    aktuellerTag = m.dateKey;
    root.innerHTML = '';
    root.appendChild(el('h2', null, 'Protokoll ' + m.dateKey));

    const leiste = el('div', 'log-leiste');
    const zurueck = el('button', 'tag-zurueck', '‹ Tag');
    zurueck.addEventListener('click', () => neuZeichnen(SW.model.shiftDays(m.dateKey, -1)));
    const vor = el('button', 'tag-vor', 'Tag ›');
    vor.addEventListener('click', () => neuZeichnen(SW.model.shiftDays(m.dateKey, 1)));
    const nach = el('button', 'nachtragen', '+ Nachtragen');
    nach.addEventListener('click', () => openEditor(m.dateKey, null));
    leiste.appendChild(zurueck);
    leiste.appendChild(vor);
    leiste.appendChild(nach);
    root.appendChild(leiste);

    const liste = el('div', 'log-liste');
    if (m.rows.length === 0) {
      liste.appendChild(el('p', 'empty', 'Kein Eintrag an diesem Tag. Nichts getan oder nicht gestempelt?'));
    } else {
      m.rows.forEach(r => {
        const zeile = el('div', 'log-row');
        zeile.dataset.id = r.id;
        const dot = el('span', 'dot');
        dot.style.background = r.color;
        zeile.appendChild(dot);

        const nm = el('span', 'nm', r.name);
        const unter = el('em', null, r.from + '–' + r.to + (r.srcLabel ? ' · ' + r.srcLabel : ''));
        nm.appendChild(unter);
        zeile.appendChild(nm);

        zeile.appendChild(el('span', 'tm', SW.ui.fmt(r.minutes)));
        zeile.addEventListener('click', () => openEditorById(m.dateKey, r.id));
        liste.appendChild(zeile);
      });
    }
    root.appendChild(liste);
    root.appendChild(el('p', 'log-summe', 'Summe: ' + SW.ui.fmtHM(m.total)));
  }

  function schliesseEditor() {
    const alt = document.querySelector('.editor');
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
  }

  function openEditorById(dateKey, id) {
    const rec = SW.storage.loadDay(dateKey);
    const e = rec ? rec.entries.filter(x => x.id === id)[0] : null;
    openEditor(dateKey, e || null);
  }

  // entry === null → Nachtrag, sonst Korrektur.
  function openEditor(dateKey, entry) {
    schliesseEditor();
    const config = SW.storage.loadConfig();
    const root = wurzel();
    const box = el('div', 'editor');

    box.appendChild(el('h3', null, entry ? 'Eintrag ändern' : 'Zeit nachtragen'));
    const fehler = el('p', 'fehler');
    fehler.style.display = 'none';
    box.appendChild(fehler);

    const cat = document.createElement('select');
    cat.name = 'cat';
    (config.categories || []).filter(c => c.active !== false).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      cat.appendChild(o);
    });
    if (entry && !(config.categories || []).some(c => c.id === entry.cat)) {
      const o = document.createElement('option');
      o.value = entry.cat; o.textContent = 'Unbekannt (' + entry.cat + ')';
      cat.appendChild(o);
    }
    if (entry) cat.value = entry.cat;
    box.appendChild(cat);

    const von = document.createElement('input');
    von.type = 'time'; von.name = 'von';
    von.value = entry ? SW.ui.fmtTime(entry.start) : '';
    box.appendChild(von);

    const bis = document.createElement('input');
    bis.type = 'time'; bis.name = 'bis';
    bis.value = entry ? SW.ui.fmtTime(entry.end) : '';
    box.appendChild(bis);

    const speichern = el('button', 'primaer', 'Speichern');
    speichern.name = 'speichern';
    speichern.addEventListener('click', function () {
      fehler.style.display = 'none';
      const startIso = dateKey + 'T' + von.value + ':00';
      const endIso = dateKey + 'T' + bis.value + ':00';
      if (!von.value || !bis.value) {
        fehler.textContent = 'Von und Bis müssen gesetzt sein.';
        fehler.style.display = '';
        return;
      }
      const jetzt = new Date();
      const res = entry
        ? SW.clock.editEntry(dateKey, entry.id, {
            cat: cat.value,
            start: SW.model.toLocalIso(new Date(startIso)),
            end: SW.model.toLocalIso(new Date(endIso))
          }, jetzt)
        : SW.clock.addManual(dateKey, cat.value,
            SW.model.toLocalIso(new Date(startIso)),
            SW.model.toLocalIso(new Date(endIso)), jetzt);
      if (!res.ok) {
        fehler.textContent = res.error;
        fehler.style.display = '';
        return;
      }
      schliesseEditor();
      neuZeichnen(dateKey);
    });
    box.appendChild(speichern);

    if (entry) {
      const loeschen = el('button', 'gefahr', 'Löschen');
      loeschen.name = 'loeschen';
      loeschen.addEventListener('click', function () {
        const res = SW.clock.deleteEntry(dateKey, entry.id);
        if (!res.ok) {
          fehler.textContent = res.error;
          fehler.style.display = '';
          return;
        }
        schliesseEditor();
        neuZeichnen(dateKey);
      });
      box.appendChild(loeschen);
    }

    const abbrechen = el('button', 'sekundaer', 'Abbrechen');
    abbrechen.name = 'abbrechen';
    abbrechen.addEventListener('click', schliesseEditor);
    box.appendChild(abbrechen);

    root.appendChild(box);
    return box;
  }

  return {
    model: model,
    render: render,
    openEditor: openEditor,
    openEditorById: openEditorById,
    refresh: neuZeichnen
  };
})();
