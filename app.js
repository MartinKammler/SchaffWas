/* app.js — verdrahtet die Oberfläche mit der Logik.
   Hier und nur hier wird die echte Uhr gelesen; alles darunter bekommt
   `now` hereingereicht. */
(function () {
  const root = document.getElementById('screen-main');
  let tick = null;

  function jetzt() { return new Date(); }

  function ladeTag(dateStr) { return SW.storage.loadDay(dateStr); }

  let letzterSpruch = null;
  let letzterZustand = null;

  // behalteSpruch: beim Takt-Neuzeichnen bleibt der Spruch stehen, solange
  // sich der Zustand nicht geändert hat.
  function zeichne(behalteSpruch) {
    const now = jetzt();
    const dateKey = SW.model.dateKeyOf(now);
    const config = SW.storage.loadConfig();
    const opts = (behalteSpruch && letzterSpruch) ? { taunt: letzterSpruch } : null;
    let m = SW.main.model(now, config, ladeTag(dateKey), ladeTag, opts);

    // Zustand gewechselt? Dann gehört ein neuer Spruch dazu.
    if (opts && m.tauntState !== letzterZustand) {
      m = SW.main.model(now, config, ladeTag(dateKey), ladeTag, null);
    }
    letzterSpruch = m.taunt;
    letzterZustand = m.tauntState;

    SW.main.render(root, m);
    zeichneLaufend();
    return m;
  }

  // Solange eine Uhr läuft, wird der Schirm im Sekundentakt neu aufgebaut:
  // die Tagessumme, der Balken und die Minimum-Stände enthalten die laufende
  // Zeit und müssen mitlaufen (Spec G2). Der Spruch bleibt dabei stehen.
  // Dazwischen zeigt die laufende Zeile mm:ss ihres aktuellen Laufs.
  function zeichneLaufend() {
    const running = SW.storage.loadRunning();
    if (tick) { clearInterval(tick); tick = null; }
    if (!running) return;
    const zeile = root.querySelector('.row.run .tm');
    if (zeile) {
      zeile.textContent = SW.ui.fmtClock((Date.now() - new Date(running.start).getTime()) / 1000);
    }
    let sekunden = 0;
    tick = setInterval(function () {
      sekunden++;
      const laufend = root.querySelector('.row.run .tm');
      if (laufend) {
        laufend.textContent = SW.ui.fmtClock((Date.now() - new Date(running.start).getTime()) / 1000);
      }
      // Einmal pro Minute den ganzen Schirm: öfter bringt bei
      // minutengenauer Anzeige nichts.
      if (sekunden % 60 === 0) zeichne(true);
    }, 1000);
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
      const ziel = b.dataset.screen;
      if (ziel === 'screen-main') zeichne();
      else if (ziel === 'screen-log' && SW.log) SW.log.refresh(SW.model.dateKeyOf(jetzt()));
      else if (ziel === 'screen-history' && SW.history) SW.history.refresh(jetzt());
      else if (ziel === 'screen-settings' && SW.settings) SW.settings.refresh();
    });
  });

  // Rückfrage und Erinnerung: beides passiert beim Sichtbarwerden,
  // nie im Hintergrund (Spec §6.4.2).
  function pruefe() {
    const res = SW.clock.checkOnVisible(jetzt());
    if (res.error) SW.ui.banner(res.error, 'error');
    if (res.action === 'ask') {
      const cfg = SW.storage.loadConfig();
      const cat = (cfg.categories || []).filter(c => c.id === res.cat)[0];
      // res.lastSeen ist der Zeitpunkt, den die Box anbietet. Er muss mit der
      // Antwort mitgehen: der Tipp selbst setzt über touchstart längst ein
      // neues lastSeen, und dann würde 'Nur bis ...' die volle Zeit buchen.
      SW.ui.ask({ cat: cat ? cat.name : res.cat, minutes: res.minutes, lastSeen: res.lastSeen }, function (choice) {
        const r = melde(SW.clock.resolveAsk(choice, jetzt(), res.lastSeen));
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

  // Jede Berührung hält lastSeen aktuell — das ist die Grundlage der
  // Rückfrage. Schlägt das Schreiben fehl, erfährt man es: sonst feuert die
  // Erinnerung bei jedem Öffnen neu und die Obergrenze trimmt zu weit zurück.
  ['click', 'keydown', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, function () { melde(SW.clock.touch(jetzt())); }, { passive: true });
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* ohne SW läuft die App weiter */ });
    });
  }

  // Fürs Testen und fürs Nachziehen von außen.
  SW.app = {
    zeichne: zeichne,
    tick: function () { return zeichne(true); },
    tauntState: function () { return letzterZustand; }
  };

  pruefe();
})();
