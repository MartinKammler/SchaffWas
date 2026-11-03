/* ui.js — gemeinsame Bausteine der Oberfläche: Bildschirmwechsel,
   Formatierung, Hinweisbanner und die Rückfrage-Box.
   Benachrichtigungen gibt es bewusst nicht (Spec §6.4.2): ohne Server
   lässt sich nichts im Hintergrund zustellen, also wird hier auch nichts
   vorgetäuscht. Der Banner ist der ganze Mechanismus. */
window.SW = window.SW || {};

SW.ui = (function () {

  function show(screenId) {
    const screens = document.querySelectorAll('.screen');
    for (let i = 0; i < screens.length; i++) {
      screens[i].classList.toggle('active', screens[i].id === screenId);
    }
    const navs = document.querySelectorAll('nav button');
    for (let i = 0; i < navs.length; i++) {
      const aktiv = navs[i].dataset.screen === screenId;
      navs[i].classList.toggle('active', aktiv);
      // Farbe allein sagt einem Screenreader nichts.
      if (aktiv) navs[i].setAttribute('aria-current', 'page');
      else navs[i].removeAttribute('aria-current');
    }
  }

  /* ── Dialoge ──────────────────────────────────────────────────
     Gemeinsame Mechanik für Rückfrage, Eintrags-Editor und
     Import-Bestätigung: Dialog-Semantik, Fokus hinein, Fokus zurück,
     Tabulator bleibt drin. Ohne das ist ein Dialog mit der Tastatur
     nicht bedienbar und für Screenreader unsichtbar. */

  function fokussierbare(box) {
    return [].slice.call(box.querySelectorAll(
      'button, [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(e => !e.disabled && !e.hidden);
  }

  // escapeSchliesst: false für Fragen, die nicht aus Versehen verschwinden
  // sollen. zu(): wie der Dialog zu schließen ist.
  function dialogOeffnen(box, opts) {
    const o = opts || {};
    const vorher = document.activeElement;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    if (o.titel) box.setAttribute('aria-label', o.titel);

    const erste = fokussierbare(box)[0] || box;
    if (erste && erste.focus) erste.focus();

    function beiTaste(ev) {
      if (ev.key === 'Escape' && o.escapeSchliesst !== false) {
        ev.preventDefault();
        schliessen();
        if (o.beiEscape) o.beiEscape();
        return;
      }
      if (ev.key !== 'Tab') return;
      const liste = fokussierbare(box);
      if (!liste.length) return;
      const erstes = liste[0], letztes = liste[liste.length - 1];
      if (ev.shiftKey && document.activeElement === erstes) {
        ev.preventDefault(); letztes.focus();
      } else if (!ev.shiftKey && document.activeElement === letztes) {
        ev.preventDefault(); erstes.focus();
      }
    }

    function schliessen() {
      document.removeEventListener('keydown', beiTaste, true);
      if (o.zu) o.zu();
      if (vorher && vorher.focus && document.contains(vorher)) vorher.focus();
    }

    document.addEventListener('keydown', beiTaste, true);
    return schliessen;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // 72 → "1:12", 27 → "27 min"
  function fmt(minutes) {
    const m = Math.round(minutes || 0);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ':' + pad2(m % 60);
  }

  // Immer Stunden:Minuten — für den großen Tageszähler und Wochenstände,
  // wo "0 min" neben "/ 4:00" schief aussieht.
  function fmtHM(minutes) {
    const m = Math.round(minutes || 0);
    return Math.floor(m / 60) + ':' + pad2(m % 60);
  }

  // Unter einer Stunde mm:ss, darüber h:mm:ss — "125:30" liest sich sonst
  // wie ein Tippfehler.
  function fmtClock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const stunden = Math.floor(s / 3600);
    const minuten = Math.floor((s % 3600) / 60);
    if (stunden > 0) return stunden + ':' + pad2(minuten) + ':' + pad2(s % 60);
    return pad2(minuten) + ':' + pad2(s % 60);
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function clearBanner() {
    const alt = document.querySelector('.banner');
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
  }

  function banner(text, kind) {
    clearBanner();
    const el = document.createElement('div');
    el.className = 'banner ' + (kind || 'remind');
    // Ein Fehler darf den Screenreader unterbrechen, ein Hinweis nicht.
    const dringend = kind === 'error';
    el.setAttribute('role', dringend ? 'alert' : 'status');
    el.setAttribute('aria-live', dringend ? 'assertive' : 'polite');
    const span = document.createElement('span');
    span.textContent = text;
    const zu = document.createElement('button');
    zu.className = 'banner-close';
    zu.setAttribute('aria-label', 'Hinweis schließen');
    zu.textContent = '✕';
    zu.addEventListener('click', clearBanner);
    el.appendChild(span);
    el.appendChild(zu);
    document.body.appendChild(el);
    return el;
  }

  let schliesseAsk = null;

  function clearAsk() {
    if (schliesseAsk) { const f = schliesseAsk; schliesseAsk = null; f(); }
    const alt = document.querySelector('.ask-backdrop');
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
  }

  // Die Rückfrage aus Spec §6.4.1. model: {cat, minutes, lastSeen}
  function ask(model, onChoice) {
    clearAsk();
    const backdrop = document.createElement('div');
    backdrop.className = 'ask-backdrop';
    const box = document.createElement('div');
    box.className = 'ask';

    const frage = document.createElement('p');
    frage.className = 'ask-frage';
    frage.textContent = `${model.cat} läuft seit ${fmt(model.minutes)} — echt?`;
    box.appendChild(frage);

    // Die Beschriftungen sagen, was passiert: der erste Knopf bucht nichts,
    // er lässt die Uhr laufen.
    const optionen = [
      { choice: 'full', label: 'Ja, ich arbeite noch — weiterlaufen lassen' },
      { choice: 'trim', label: `Bis ${fmtTime(model.lastSeen)} eintragen und stoppen` },
      { choice: 'edit', label: 'Zeit selbst korrigieren' }
    ];
    optionen.forEach(o => {
      const b = document.createElement('button');
      b.textContent = o.label;
      b.dataset.choice = o.choice;
      b.addEventListener('click', () => {
        clearAsk();
        if (onChoice) onChoice(o.choice);
      });
      box.appendChild(b);
    });

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    // Escape beantwortet die Frage nicht — sie ist zu wichtig, um aus
    // Versehen zu verschwinden.
    schliesseAsk = dialogOeffnen(box, {
      titel: 'Läuft die Uhr noch?',
      escapeSchliesst: false
    });
    return box;
  }

  return {
    show: show,
    dialogOeffnen: dialogOeffnen,
    fmt: fmt,
    fmtHM: fmtHM,
    fmtClock: fmtClock,
    fmtTime: fmtTime,
    banner: banner,
    clearBanner: clearBanner,
    ask: ask,
    clearAsk: clearAsk
  };
})();
