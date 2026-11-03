/* ui-main.js — der Hauptschirm.
   model() ist rein und ohne DOM, damit die Rechnerei testbar bleibt;
   render() baut nur noch, was model() liefert. */
window.SW = window.SW || {};

SW.main = (function () {

  const EXPORT_HINWEIS_AB_TAGEN = 14;

  function aktive(config) {
    return (config.categories || []).filter(c => c && c.active !== false);
  }

  function minLabelFor(cat, tagesMinuten, wochenMinuten) {
    const need = cat.minMinutes || 0;
    if (need <= 0) return '';
    const have = cat.minPeriod === 'week' ? wochenMinuten : tagesMinuten;
    if (have >= need) return 'Minimum erfüllt ✓';
    if (cat.minPeriod === 'week') {
      return `${SW.ui.fmtHM(have)} / ${SW.ui.fmtHM(need)} diese Woche`;
    }
    return `${Math.floor(have)} / ${need} min heute`;
  }

  function exportHinweis(now) {
    const letzter = SW.storage.lastExportAt();
    // Wer nie exportiert hat, ist am meisten gefährdet — und bekam vorher
    // als Einziger gar keinen Hinweis.
    if (!letzter) return 'Noch nie gesichert. Ein Backup kostet zwei Tipper.';
    const tage = Math.floor((now.getTime() - new Date(letzter).getTime()) / 86400000);
    if (tage < EXPORT_HINWEIS_AB_TAGEN) return null;
    return `Letzter Export vor ${tage} Tagen.`;
  }

  // Die laufende Uhr steht in keinem Tagesobjekt. Ohne sie stünde die
  // dominante Zahl still, solange gearbeitet wird (Spec G2, §6.1): deshalb
  // wird sie als virtueller Eintrag eingerechnet — nur mit dem Teil, der auf
  // den heutigen Tag fällt.
  function mitLaufender(dayRec, dateKey, now, running) {
    if (!running) return dayRec;
    const virtuell = {
      id: '__laufend__',
      cat: running.cat,
      start: running.start,
      end: SW.model.toLocalIso(now),
      src: 'timer'
    };
    const heute = SW.model.splitAtMidnight(virtuell)
      .filter(teil => SW.model.dateKeyOf(teil.start) === dateKey);
    if (!heute.length) return dayRec;
    const basis = dayRec || { entries: [] };
    return {
      target: basis.target,
      mins: basis.mins,
      entries: (basis.entries || []).concat(heute)
    };
  }

  // opts.taunt hält den Spruch fest: im Sekundentakt soll die Zahl laufen,
  // nicht der Text springen.
  function model(now, config, dayRec, loadDay, opts) {
    const dateKey = SW.model.dateKeyOf(now);
    const running = SW.storage.loadRunning();
    const dayRecMitUhr = mitLaufender(dayRec, dateKey, now, running);
    const status = SW.model.dayStatus(dateKey, dayRecMitUhr, config);
    const woche = SW.model.weekStatus(dateKey, loadDay, config);
    const wochenSummen = {};
    const range = SW.model.weekRange(dateKey);
    let tagImLauf = range.from;
    for (let i = 0; i < 7; i++) {
      const rec = (tagImLauf === dateKey)
        ? dayRecMitUhr
        : mitLaufender(loadDay(tagImLauf), tagImLauf, now, running);
      const t = SW.model.dayTotals(rec);
      Object.keys(t.byCat).forEach(cat => { wochenSummen[cat] = (wochenSummen[cat] || 0) + t.byCat[cat]; });
      tagImLauf = SW.model.shiftDays(tagImLauf, 1);
    }
    const wochenGesamt = Object.keys(wochenSummen).reduce((a, k) => a + wochenSummen[k], 0);

    // Läuft eine Kategorie, die inzwischen stillgelegt oder gelöscht wurde,
    // muss sie trotzdem eine Zeile bekommen — sonst gibt es keinen
    // Stopp-Knopf mehr und die Uhr läuft unbemerkt weiter.
    const kategorien = aktive(config);
    if (running && !kategorien.some(c => c.id === running.cat)) {
      const bekannt = (config.categories || []).filter(c => c.id === running.cat)[0];
      kategorien.push(bekannt
        ? Object.assign({}, bekannt, { active: true })
        : { id: running.cat, name: 'Unbekannt', color: '#6b7280', minMinutes: 0, minPeriod: 'day', active: true });
    }

    // Der Balken zeigt den Anteil am Tagessoll; über 100 % wird gedeckelt,
    // damit er nicht aus dem Rahmen läuft.
    const bar = [];
    let rest = 1;
    kategorien.forEach(c => {
      const min = status.byCat[c.id] || 0;
      if (min <= 0) return;
      const roh = status.target > 0 ? min / status.target : 0;
      const share = Math.max(0, Math.min(roh, rest));
      rest -= share;
      bar.push({ cat: c.id, color: c.color, minutes: min, share: share });
    });

    const rows = kategorien.map(c => ({
      cat: c.id,
      name: c.name,
      color: c.color,
      minutes: status.byCat[c.id] || 0,
      weekMinutes: wochenSummen[c.id] || 0,
      running: !!(running && running.cat === c.id),
      minLabel: minLabelFor(c, status.byCat[c.id] || 0, wochenSummen[c.id] || 0),
      minDone: (c.minMinutes || 0) > 0 &&
        ((c.minPeriod === 'week' ? (wochenSummen[c.id] || 0) : (status.byCat[c.id] || 0)) >= c.minMinutes)
    }));

    const streak = SW.model.streak(dateKey, loadDay, config);
    const gestern = SW.model.shiftDays(dateKey, -1);
    const gesternRec = loadDay(gestern);
    const gesternStatus = SW.model.dayStatus(gestern, gesternRec, config);
    // Ohne jede Historie ist die Serie nicht gebrochen, sondern hat noch nicht
    // angefangen — "Serie futsch" als allererster Satz der App wäre Unsinn.
    const streakBroken = streak === 0 && !gesternStatus.free && !!gesternRec;
    const tauntState = SW.taunts.stateFor({ dayStatus: status, weekStatus: woche, streakBroken: streakBroken, now: now });

    return {
      dateKey: dateKey,
      tauntState: tauntState,
      taunt: (opts && opts.taunt) ? opts.taunt : SW.taunts.pick(tauntState, config),
      missingNames: status.missing.map(m => {
        const k = (config.categories || []).filter(c => c.id === m.cat)[0];
        return k ? k.name : m.cat;
      }),
      total: status.total,
      target: status.target,
      fulfilled: status.fulfilled,
      free: status.free,
      missing: status.missing,
      bar: bar,
      rows: rows,
      streak: streak,
      weekTotal: wochenGesamt,
      running: running,
      exportHint: exportHinweis(now)
    };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function render(root, m) {
    root.innerHTML = '';

    const kopf = el('div', 'kopf');
    const logo = el('img', 'sau' + (m.fulfilled ? ' sau-auf' : ''));
    logo.src = './Logo-Sau.png';
    logo.alt = 'Faule Sau';
    kopf.appendChild(logo);
    kopf.appendChild(el('p', 'taunt', m.taunt));
    root.appendChild(kopf);

    const hero = el('div', 'hero' + (m.fulfilled ? ' ok' : ''));
    const num = el('div', 'num');
    num.appendChild(el('span', 'num-ist', SW.ui.fmtHM(m.total)));
    num.appendChild(el('span', 'num-soll', ' / ' + SW.ui.fmtHM(m.target)));
    hero.appendChild(num);
    hero.appendChild(el('div', 'lbl', m.free ? 'Heute frei' : (m.fulfilled ? 'Tagessoll erfüllt ✓' : 'Tagessoll')));

    const track = el('div', 'track');
    m.bar.forEach(seg => {
      const i = el('i');
      i.style.width = (seg.share * 100).toFixed(2) + '%';
      i.style.background = m.fulfilled ? '#38c172' : seg.color;
      i.title = seg.cat + ' ' + SW.ui.fmt(seg.minutes);
      track.appendChild(i);
    });
    hero.appendChild(track);

    const legend = el('div', 'legend');
    const rest = Math.max(0, m.target - m.total);
    legend.appendChild(el('span', null, m.free ? 'kein Soll heute' : (rest > 0 ? SW.ui.fmt(rest) + ' fehlen' : 'alles drin')));
    legend.appendChild(el('span', null, m.missingNames.length ? m.missingNames.join(', ') + ' offen' : ''));
    hero.appendChild(legend);
    root.appendChild(hero);

    m.rows.forEach(r => {
      const row = el('div', 'row' + (r.running ? ' run' : ''));
      row.dataset.cat = r.cat;

      const dot = el('span', 'dot');
      dot.style.background = r.minDone ? '#38c172' : r.color;
      row.appendChild(dot);

      const nm = el('span', 'nm', r.name);
      nm.appendChild(el('em', null, r.minLabel));
      row.appendChild(nm);

      row.appendChild(el('span', 'tm', SW.ui.fmt(r.minutes)));

      const btn = el('button', 'btn ' + (r.running ? 'stop' : 'play'), r.running ? '■' : '▶');
      btn.dataset.cat = r.cat;
      btn.dataset.action = r.running ? 'stop' : 'start';
      btn.setAttribute('aria-label', (r.running ? 'Stoppen: ' : 'Starten: ') + r.name);
      row.appendChild(btn);

      root.appendChild(row);
    });

    const fuss = el('div', 'fuss');
    fuss.appendChild(el('span', null, '🔥 ' + m.streak + (m.streak === 1 ? ' Tag Serie' : ' Tage Serie')));
    fuss.appendChild(el('span', null, 'Woche ' + SW.ui.fmt(m.weekTotal)));
    root.appendChild(fuss);

    if (m.exportHint) {
      root.appendChild(el('p', 'export-hint', m.exportHint));
    }
  }

  return { model: model, render: render };
})();
