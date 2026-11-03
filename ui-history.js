/* ui-history.js — Historie: Woche und Monat.
   Bewusst schlicht gehalten (Spec §9): erfüllte Tage, Summen, Verteilung,
   Serie. Keine Diagramm-Spielwiese. */
window.SW = window.SW || {};

SW.history = (function () {

  const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const UNBEKANNT = { name: 'Unbekannt', color: '#6b7280' };

  let ansicht = 'week';
  let anker = null;
  // Solange nicht geblättert wurde, folgt die Ansicht dem heutigen Tag —
  // eine über Mitternacht offene App soll nicht in der alten Woche hängen.
  let verschoben = false;

  function katOf(catId, config) {
    return (config.categories || []).filter(c => c.id === catId)[0] || UNBEKANNT;
  }

  function wochentagVon(dateKey) {
    const p = dateKey.split('-');
    return WOCHENTAGE[new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12).getDay()];
  }

  function heuteKey() { return SW.model.dateKeyOf(new Date()); }

  // rec darf mitgegeben werden, damit derselbe Tag nicht zweimal aus dem
  // Speicher gelesen und geparst wird.
  function tagZeile(dateKey, loadDay, config, heute, recVorab) {
    const rec = recVorab !== undefined ? recVorab : loadDay(dateKey);
    const st = SW.model.dayStatus(dateKey, rec, config);
    // Ein Tag, der noch kommt, ist nicht verpasst — er ist offen. Sonst
    // sieht die Woche am Montag schon nach Pechsträhne aus.
    const future = dateKey > (heute || heuteKey());
    return {
      dateKey: dateKey,
      weekday: wochentagVon(dateKey),
      total: st.total,
      target: st.target,
      fulfilled: st.fulfilled,
      free: st.free,
      future: future,
      verpasst: !future && !st.free && !st.fulfilled
    };
  }

  function weekModel(dateStr, loadDay, config, heute) {
    const range = SW.model.weekRange(dateStr);
    const woche = SW.model.weekStatus(dateStr, loadDay, config);
    const bezug = heute || heuteKey();

    const days = [];
    let tag = range.from;
    for (let i = 0; i < 7; i++) {
      days.push(tagZeile(tag, loadDay, config, bezug));
      tag = SW.model.shiftDays(tag, 1);
    }

    const weekMins = Object.keys(woche.byCat).map(cat => ({
      cat: cat,
      name: katOf(cat, config).name,
      color: katOf(cat, config).color,
      have: woche.byCat[cat].have,
      need: woche.byCat[cat].need,
      done: woche.byCat[cat].have >= woche.byCat[cat].need
    }));

    return {
      view: 'week',
      from: range.from,
      to: range.to,
      days: days,
      weekMins: weekMins,
      total: woche.total,
      verpasst: days.filter(d => d.verpasst).length,
      laeuft: range.to >= bezug && range.from <= bezug,
      fulfilled: woche.fulfilled
    };
  }

  function monthModel(ym, loadDay, config, heute) {
    const jahr = Number(ym.slice(0, 4));
    const monat = Number(ym.slice(5, 7));
    const anzahl = new Date(jahr, monat, 0).getDate();
    const bezug = heute || heuteKey();

    const days = [];
    const summen = {};
    let total = 0;
    let fulfilledCount = 0;
    let verpasst = 0;

    for (let d = 1; d <= anzahl; d++) {
      const dateKey = ym + '-' + (d < 10 ? '0' + d : d);
      const rec = loadDay(dateKey);
      const zeile = tagZeile(dateKey, loadDay, config, bezug, rec);
      days.push(zeile);
      if (zeile.fulfilled) fulfilledCount++;
      if (zeile.verpasst) verpasst++;
      const t = SW.model.dayTotals(rec);
      total += t.total;
      Object.keys(t.byCat).forEach(cat => { summen[cat] = (summen[cat] || 0) + t.byCat[cat]; });
    }

    const byCat = Object.keys(summen).map(cat => ({
      cat: cat,
      name: katOf(cat, config).name,
      color: katOf(cat, config).color,
      minutes: summen[cat],
      share: total > 0 ? summen[cat] / total : 0
    })).sort((a, b) => b.minutes - a.minutes);

    return {
      view: 'month', ym: ym, days: days,
      fulfilledCount: fulfilledCount, verpasst: verpasst,
      total: total, byCat: byCat,
      laeuft: ym === bezug.slice(0, 7)
    };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function wurzel() { return document.getElementById('screen-history') || document.getElementById('buehne'); }

  function refresh(now) {
    const heute = SW.model.dateKeyOf(now || new Date());
    if (!verschoben || !anker) anker = heute;
    const config = SW.storage.loadConfig();
    const laden = SW.storage.loadDay;
    const m = ansicht === 'week'
      ? weekModel(anker, laden, config, heute)
      : monthModel(anker.slice(0, 7), laden, config, heute);
    render(wurzel(), m, ansicht);
  }

  function blaettern(richtung) {
    if (ansicht === 'week') {
      anker = SW.model.shiftDays(anker, richtung * 7);
    } else {
      const jahr = Number(anker.slice(0, 4));
      const monat = Number(anker.slice(5, 7)) - 1 + richtung;
      const d = new Date(jahr, monat, 1, 12);
      anker = SW.model.dateKeyOf(d);
    }
    verschoben = true;
    refresh();
  }

  function zurueckInDieGegenwart() {
    verschoben = false;
    anker = null;
    refresh();
  }

  // Für die Tests und für Sprünge von außen.
  function setAnker(dateKey) { anker = dateKey; verschoben = false; }
  function setAnsicht(wert) { ansicht = wert; }

  function render(root, m, view) {
    root.innerHTML = '';
    root.appendChild(el('h2', null, view === 'week' ? ('Woche ' + m.from + ' bis ' + m.to) : ('Monat ' + m.ym)));

    const umschalter = el('div', 'hist-umschalter');
    [['week', 'Woche'], ['month', 'Monat']].forEach(([wert, label]) => {
      const b = el('button', view === wert ? 'active' : null, label);
      b.dataset.view = wert;
      b.addEventListener('click', () => { ansicht = wert; refresh(); });
      umschalter.appendChild(b);
    });
    root.appendChild(umschalter);

    const blaetterLeiste = el('div', 'hist-blaettern');
    const zurueck = el('button', null, view === 'week' ? '‹ Woche' : '‹ Monat');
    zurueck.name = 'zurueck';
    zurueck.addEventListener('click', () => blaettern(-1));
    blaetterLeiste.appendChild(zurueck);

    if (!m.laeuft) {
      const heuteKnopf = el('button', 'jetzt', 'Heute');
      heuteKnopf.name = 'heute';
      heuteKnopf.addEventListener('click', zurueckInDieGegenwart);
      blaetterLeiste.appendChild(heuteKnopf);
    }

    const vor = el('button', null, view === 'week' ? 'Woche ›' : 'Monat ›');
    vor.name = 'vor';
    vor.addEventListener('click', () => blaettern(1));
    blaetterLeiste.appendChild(vor);
    root.appendChild(blaetterLeiste);

    const liste = el('div', 'hist-liste');
    const sichtbare = view === 'week' ? m.days : m.days.filter(d => d.total > 0 || !d.free);
    if (view === 'month' && m.total === 0) {
      liste.appendChild(el('p', 'empty', 'In diesem Monat ist nichts gestempelt.'));
    } else {
      sichtbare.forEach(d => {
        const klassen = ['hist-day'];
        if (d.fulfilled) klassen.push('ok');
        if (d.free) klassen.push('frei');
        if (d.future) klassen.push('kommt');
        else if (d.verpasst) klassen.push('offen');
        const zeile = el('div', klassen.join(' '));
        zeile.appendChild(el('span', 'hd-tag', d.weekday + ' ' + d.dateKey.slice(8)));
        const balken = el('div', 'hd-balken');
        const i = el('i');
        i.style.width = (d.target > 0 ? Math.min(100, (d.total / d.target) * 100) : 0) + '%';
        balken.appendChild(i);
        zeile.appendChild(balken);
        const text = d.future ? 'kommt noch'
          : (d.free && d.total === 0) ? 'frei'
            : SW.ui.fmtHM(d.total);
        zeile.appendChild(el('span', 'hd-zeit', text));
        liste.appendChild(zeile);
      });
    }
    root.appendChild(liste);

    if (view === 'week') {
      const box = el('div', 'hist-mins');
      box.appendChild(el('h3', null, 'Wochen-Minima'));
      m.weekMins.forEach(w => {
        const z = el('div', 'hist-min' + (w.done ? ' ok' : ''));
        z.appendChild(el('span', 'nm', w.name));
        z.appendChild(el('span', 'tm', SW.ui.fmtHM(w.have) + ' / ' + SW.ui.fmtHM(w.need)));
        box.appendChild(z);
      });
      box.appendChild(el('p', 'hist-summe', 'Woche gesamt: ' + SW.ui.fmtHM(m.total) + (m.fulfilled ? ' · erfüllt ✓' : '')));
      root.appendChild(box);
    } else {
      const box = el('div', 'hist-cats');
      box.appendChild(el('h3', null, 'Verteilung'));
      m.byCat.forEach(c => {
        const z = el('div', 'hist-cat');
        const dot = el('span', 'dot');
        dot.style.background = c.color;
        z.appendChild(dot);
        z.appendChild(el('span', 'nm', c.name));
        z.appendChild(el('span', 'tm', SW.ui.fmtHM(c.minutes) + ' · ' + Math.round(c.share * 100) + ' %'));
        box.appendChild(z);
      });
      box.appendChild(el('p', 'hist-summe', m.fulfilledCount + ' erfüllte Tage · ' + SW.ui.fmtHM(m.total) + ' gesamt'));
      root.appendChild(box);
    }
  }

  return {
    weekModel: weekModel,
    monthModel: monthModel,
    render: render,
    refresh: refresh,
    blaettern: blaettern,
    setAnker: setAnker,
    setAnsicht: setAnsicht
  };
})();
