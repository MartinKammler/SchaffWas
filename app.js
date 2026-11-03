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

  /* ── Service Worker: Registrierung und Update-Hinweis ─────────────
     Cache-First heißt: eine offene App übernimmt eine neue Version nicht von
     selbst. Also wird sie gemeldet — und erst auf Zustimmung übernommen.
     Nie von alleine neu laden: der Nutzer könnte gerade etwas eintippen oder
     eine Uhr laufen haben. */

  // Beim Laden gemerkt: steuerte schon ein Worker diese Seite? Nur dann ist
  // ein controllerchange ein echter Wechsel. Beim allerersten Besuch
  // übernimmt ein frischer Worker, ohne dass sich etwas geändert hätte.
  const hatteController = ('serviceWorker' in navigator) && !!navigator.serviceWorker.controller;
  let ladeNeu = false;
  let updateStreifen = null;
  let letztePruefung = 0;

  // Ein controllerchange darf genau einmal neu laden, und nur wenn vorher
  // schon ein Worker da war — sonst lädt die Seite im Kreis.
  function darfNeuLaden(hatteVorherController, schonAmLaden) {
    return !!hatteVorherController && !schonAmLaden;
  }

  // Der Hinweis: ein Banner mit einem Knopf. Wegklickbar wie jeder andere;
  // wird er weggeklickt, darf er beim nächsten Fund wieder erscheinen.
  function updateHinweis(reg) {
    if (!reg || !reg.waiting) return null;
    if (updateStreifen && updateStreifen.isConnected) return updateStreifen;

    const streifen = SW.ui.banner('Neue Version verfügbar', 'remind');
    const knopf = document.createElement('button');
    knopf.type = 'button';
    // Eigenes kleines Element: app.css kennt keinen Textknopf im Banner.
    // Die Farben erbt er vom Streifen, die Form ist die des Schließen-Knopfes.
    knopf.style.cssText = 'flex:none;border:0;cursor:pointer;border-radius:8px;'
      + 'padding:5px 10px;background:rgba(0,0,0,.15);color:inherit;'
      + 'font:inherit;font-size:.72rem;font-weight:700;';
    knopf.textContent = 'Aktualisieren';
    knopf.addEventListener('click', function () {
      if (knopf.disabled) return;
      knopf.disabled = true;
      knopf.textContent = 'Aktualisiere …';
      // Erst jetzt darf der wartende Worker übernehmen. Das Neuladen macht
      // der controllerchange-Horcher — genau einmal.
      if (reg.waiting) reg.waiting.postMessage({ typ: 'SKIP_WAITING' });
    });
    streifen.insertBefore(knopf, streifen.querySelector('.banner-close'));
    updateStreifen = streifen;
    return streifen;
  }

  if ('serviceWorker' in navigator) {
    // Der Wechsel läuft immer über controllerchange — ob der Nutzer
    // zugestimmt hat oder der Browser von selbst gewechselt ist.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!darfNeuLaden(hatteController, ladeNeu)) return;
      ladeNeu = true;
      window.location.reload();
    });

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        // Wartet schon einer? Dann wurde die neue Version bei einem früheren
        // Besuch fertig installiert.
        updateHinweis(reg);

        reg.addEventListener('updatefound', function () {
          const neu = reg.installing;
          if (!neu) return;
          neu.addEventListener('statechange', function () {
            // 'installed' und die Seite hat schon einen Worker: ein Update.
            // Ohne Controller ist es der Erstbesuch — da gibt es nichts zu
            // melden. Scheitert die Installation, kommt 'redundant' statt
            // 'installed' und es erscheint zu Recht kein Hinweis.
            if (neu.state === 'installed' && navigator.serviceWorker.controller) updateHinweis(reg);
          });
        });

        // Eine wochenlang offene App fragt von selbst kaum nach. Beim
        // Zurückkommen also nachsehen, höchstens aber alle 15 Minuten.
        document.addEventListener('visibilitychange', function () {
          if (document.hidden) return;
          if (Date.now() - letztePruefung < 15 * 60 * 1000) return;
          letztePruefung = Date.now();
          reg.update().catch(function () { /* kein Netz: beim nächsten Mal */ });
        });
      }).catch(function () { /* ohne SW läuft die App weiter */ });
    });
  }

  // Startbild: der volle Sticker mit Schriftzug. Zeigt sich beim Öffnen und
  // geht nach kurzer Zeit oder beim ersten Tipp weg — es soll begrüßen, nicht
  // aufhalten (Spec §8).
  const SPLASH_MS = 1400;
  let splashTimer = null;

  // Die Version steht beim Laden im Startbild — so sieht man nach einem
  // Update auf einen Blick, was gerade laeuft.
  (function versionEintragen() {
    const feld = document.getElementById('splash-version');
    if (feld && typeof APP_VERSION === 'string') feld.textContent = 'Version ' + APP_VERSION;
  })();

  function versteckeStartbild() {
    const splash = document.getElementById('splash');
    if (!splash || splash.classList.contains('weg')) return;
    splash.classList.add('weg');
    if (splashTimer) { clearTimeout(splashTimer); splashTimer = null; }
  }

  function zeigeStartbild(dauer) {
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.remove('weg');
    if (splashTimer) clearTimeout(splashTimer);
    splashTimer = setTimeout(versteckeStartbild, dauer === undefined ? SPLASH_MS : dauer);
    splash.addEventListener('click', versteckeStartbild, { once: true });
    splash.addEventListener('touchstart', versteckeStartbild, { once: true, passive: true });
  }

  // Fürs Testen und fürs Nachziehen von außen.
  SW.app = {
    zeigeStartbild: zeigeStartbild,
    versteckeStartbild: versteckeStartbild,
    zeichne: zeichne,
    tick: function () { return zeichne(true); },
    tauntState: function () { return letzterZustand; },
    updateHinweis: updateHinweis,
    darfNeuLaden: darfNeuLaden
  };

  pruefe();
  zeigeStartbild();
})();
