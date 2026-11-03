/* app.js — verdrahtet die Oberfläche mit der Logik.
   Hier und nur hier wird die echte Uhr gelesen; alles darunter bekommt
   `now` hereingereicht. */
(function () {
  const root = document.getElementById('screen-main');
  let tick = null;

  function jetzt() { return new Date(); }

  function ladeTag(dateStr) { return SW.storage.loadDay(dateStr); }

  function zeichne() {
    const now = jetzt();
    const dateKey = SW.model.dateKeyOf(now);
    const config = SW.storage.loadConfig();
    const m = SW.main.model(now, config, ladeTag(dateKey), ladeTag);
    SW.main.render(root, m);
    zeichneLaufend();
  }

  // Die laufende Kategorie zeigt mm:ss. Nur diese eine Zahl wird im
  // Sekundentakt angefasst, nicht der ganze Schirm.
  function zeichneLaufend() {
    const running = SW.storage.loadRunning();
    if (tick) { clearInterval(tick); tick = null; }
    if (!running) return;
    const zeile = root.querySelector('.row.run .tm');
    if (!zeile) return;
    const start = new Date(running.start);
    const aktualisiere = () => {
      zeile.textContent = SW.ui.fmtClock((Date.now() - start.getTime()) / 1000);
    };
    aktualisiere();
    tick = setInterval(aktualisiere, 1000);
  }

  function melde(res) {
    if (res && res.ok === false && res.error) SW.ui.banner(res.error, 'error');
    return res;
  }

  root.addEventListener('click', function (ev) {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const now = jetzt();
    if (btn.dataset.action === 'start') melde(SW.clock.start(btn.dataset.cat, now));
    else melde(SW.clock.stop(now));
    zeichne();
  });

  document.querySelectorAll('nav button').forEach(b => {
    b.addEventListener('click', () => {
      SW.ui.show(b.dataset.screen);
      if (b.dataset.screen === 'screen-main') zeichne();
      else if (typeof SW.screens === 'object' && SW.screens[b.dataset.screen]) SW.screens[b.dataset.screen]();
    });
  });

  // Rückfrage und Erinnerung: beides passiert beim Sichtbarwerden,
  // nie im Hintergrund (Spec §6.4.2).
  function pruefe() {
    const res = SW.clock.checkOnVisible(jetzt());
    if (res.action === 'ask') {
      const cfg = SW.storage.loadConfig();
      const cat = (cfg.categories || []).filter(c => c.id === res.cat)[0];
      SW.ui.ask({ cat: cat ? cat.name : res.cat, minutes: res.minutes, lastSeen: res.lastSeen }, function (choice) {
        const r = melde(SW.clock.resolveAsk(choice, jetzt()));
        zeichne();
        if (choice === 'edit' && r && r.ok && SW.log && SW.log.openEditorById) {
          SW.ui.show('screen-log');
          SW.log.openEditorById(r.dateKey, r.entryId);
        }
      });
    } else if (res.action === 'remind') {
      SW.ui.banner('Läuft die Uhr noch, oder du?', 'remind');
    } else if (res.action === 'hardstop') {
      SW.ui.banner('Die Uhr lief zu lange ohne dich — gebucht bis zur letzten Berührung.', 'error');
    }
    zeichne();
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) pruefe();
  });

  ['click', 'keydown', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, function () { SW.clock.touch(jetzt()); }, { passive: true });
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* ohne SW läuft die App weiter */ });
    });
  }

  pruefe();
})();
