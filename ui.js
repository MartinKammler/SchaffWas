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
      navs[i].classList.toggle('active', navs[i].dataset.screen === screenId);
    }
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

  function fmtClock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
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

  function clearAsk() {
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

    const optionen = [
      { choice: 'full', label: 'Ja, voll buchen' },
      { choice: 'trim', label: `Nur bis ${fmtTime(model.lastSeen)} (letzte Berührung)` },
      { choice: 'edit', label: 'Zeit selbst eintragen' }
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
    return box;
  }

  return {
    show: show,
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
