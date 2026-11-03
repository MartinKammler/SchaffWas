/* clock.js — die Stempelsteuerung.
   Rechnet nie selbst mit der Uhr: `now` kommt immer als Date von außen,
   damit jeder Pfad testbar bleibt. Schreibt ausschließlich über SW.storage. */
window.SW = window.SW || {};

SW.clock = (function () {
  const M = () => SW.model;
  const S = () => SW.storage;

  // Zufalls-Id für Nachträge. Zwei Nachträge in derselben Millisekunde sind
  // Handarbeit und praktisch ausgeschlossen; trotzdem wird kollisionsfrei
  // weitergezählt (siehe freieId).
  function neueId(now) {
    return 'e' + now.getTime().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  }

  // Id eines gestempelten Eintrags: leitet sich aus seinem Start ab und ist
  // damit über Versuche hinweg stabil. Das macht das Buchen wiederholbar —
  // ein zweiter Stopp nach einem Schreibfehler kann denselben Abschnitt nicht
  // ein zweites Mal anlegen.
  function stempelId(startIso) {
    return 's' + new Date(startIso).getTime().toString(36);
  }

  function freieId(rec, id) {
    if (!rec || !Array.isArray(rec.entries)) return id;
    let kandidat = id, n = 2;
    while (rec.entries.some(e => e.id === kandidat)) { kandidat = id + '+' + n; n++; }
    return kandidat;
  }

  function minutenZwischen(a, b) {
    const ms = b.getTime() - a.getTime();
    return ms > 0 ? ms / 60000 : 0;
  }

  // Hängt Einträge an ihre Tage und legt bei einem noch leeren Tag den
  // Regel-Abzug an (Spec §7.2). Ein bestehender Abzug bleibt unangetastet.
  //
  // Ein Eintrag über Mitternacht berührt zwei Tage und womöglich zwei
  // Monatsschlüssel. Schlägt die zweite Schreibung fehl, darf die erste nicht
  // liegen bleiben: beim nächsten Stopp würde sie ein zweites Mal gebucht.
  // Deshalb wird vorher gesichert und bei jedem Fehler zurückgerollt.
  function bucheTeile(teile, config) {
    const vorher = [];
    for (let i = 0; i < teile.length; i++) {
      const teil = teile[i];
      const dateKey = M().dateKeyOf(teil.start);
      vorher.push({ dateKey: dateKey, rec: S().loadDay(dateKey) });

      let rec = S().loadDay(dateKey);
      if (!rec) {
        const snap = M().snapshotRules(dateKey, config);
        rec = { target: snap.target, mins: snap.mins, entries: [] };
      }
      // Schon gebucht (Wiederholung nach einem Fehlschlag)? Dann überspringen.
      if (rec.entries.some(e => e.id === teil.id)) continue;

      rec.entries.push(teil);
      const res = S().saveDay(dateKey, rec);
      if (!res.ok) {
        rolleZurueck(vorher);
        return res;
      }
    }
    return { ok: true };
  }

  function rolleZurueck(vorher) {
    for (let i = vorher.length - 1; i >= 0; i--) {
      const stand = vorher[i];
      if (stand.rec) S().saveDay(stand.dateKey, stand.rec);
      else S().removeDay(stand.dateKey);
    }
  }

  function beende(running, endeDate, src, config) {
    const eintrag = {
      id: stempelId(running.start),
      cat: running.cat,
      start: running.start,
      end: M().toLocalIso(endeDate),
      src: src
    };
    if (M().entryMinutes(eintrag) <= 0) return { ok: true, entries: [] };
    const teile = M().splitAtMidnight(eintrag);
    const res = bucheTeile(teile, config);
    if (!res.ok) return res;
    return { ok: true, entries: teile };
  }

  /* ── Stempeln ───────────────────────────────────────────────── */

  function stop(now, src) {
    const running = S().loadRunning();
    if (!running) return { ok: true, entries: [] };
    const res = beende(running, now, src || 'timer', S().loadConfig());
    if (!res.ok) return res;
    S().clearRunning();
    return res;
  }

  function start(catId, now) {
    const laufend = S().loadRunning();
    if (laufend) {
      if (laufend.cat === catId) return { ok: true };
      const res = stop(now);
      if (!res.ok) return res;
    }
    const iso = M().toLocalIso(now);
    return S().saveRunning({ cat: catId, start: iso, lastSeen: iso, reminded: false, asked: false });
  }

  function touch(now) {
    const running = S().loadRunning();
    if (!running) return { ok: true };
    running.lastSeen = M().toLocalIso(now);
    return S().saveRunning(running);
  }

  /* ── Rückfrage, Erinnerung, harte Obergrenze ────────────────── */

  // Wird beim Sichtbarwerden der Seite gerufen. Erst auswerten (mit dem ALTEN
  // lastSeen), dann lastSeen setzen — umgekehrt würde die Rückfrage nie feuern.
  function checkOnVisible(now) {
    const running = S().loadRunning();
    if (!running) return { action: 'none' };

    const cfg = S().loadConfig();
    const start_ = new Date(running.start);
    const lastSeen = new Date(running.lastSeen || running.start);
    const laufzeit = minutenZwischen(start_, now);
    const unbeachtet = minutenZwischen(lastSeen, now);

    // "Ja, ich arbeite noch" startet einen neuen Beobachtungsabschnitt — es
    // schaltet die Überwachung nicht für immer ab. Sonst läuft eine einmal
    // bestätigte Uhr durch die Nacht und bucht Tag für Tag volle 24 Stunden.
    // Bestand aus älteren Versionen kennt nur `asked` ohne Zeitpunkt; dort
    // gilt die letzte Berührung als Bestätigung.
    const bestaetigtAm = running.confirmedAt
      ? new Date(running.confirmedAt)
      : (running.asked ? lastSeen : start_);
    const seitBestaetigung = minutenZwischen(bestaetigtAm, now);

    // Harte Obergrenze: der Schutz gegen die durchlaufende Nacht — und nur
    // dafür. Wer die App regelmäßig anfasst, arbeitet; dem wird die Uhr nicht
    // unter den Händen weggenommen (Spec §6.4.1, A6).
    if (seitBestaetigung >= cfg.hardStopMinutes && unbeachtet >= cfg.askAfterMinutes) {
      const res = beende(running, lastSeen, 'autostop', cfg);
      if (!res.ok) return { action: 'none', error: res.error };
      S().clearRunning();
      return { action: 'hardstop', minutes: laufzeit, lastSeen: running.lastSeen };
    }

    // lastSeen bleibt hier bewusst stehen: 'Nur bis letzte Berührung' braucht
    // genau diesen Zeitpunkt. Erst resolveAsk setzt ihn weiter.
    // Die Erinnerung gilt als erledigt — die Rückfrage fragt dasselbe, schärfer.
    if (unbeachtet >= cfg.askAfterMinutes) {
      if (!running.reminded) {
        running.reminded = true;
        S().saveRunning(running);
      }
      return { action: 'ask', minutes: laufzeit, idleMinutes: unbeachtet, lastSeen: running.lastSeen, cat: running.cat };
    }

    if (!running.reminded && laufzeit >= cfg.reminderMinutes) {
      running.reminded = true;
      running.lastSeen = M().toLocalIso(now);
      S().saveRunning(running);
      return { action: 'remind', minutes: laufzeit, cat: running.cat };
    }

    running.lastSeen = M().toLocalIso(now);
    S().saveRunning(running);
    return { action: 'none', minutes: laufzeit };
  }

  // choice: 'full' (weiterlaufen), 'trim' (beim Zeitpunkt der Rückfrage
  // beenden), 'edit' (jetzt beenden und den Eintrag zum Bearbeiten melden).
  //
  // trimAt kommt aus dem Rückgabewert von checkOnVisible und ist der Grund,
  // warum der Trimm-Zeitpunkt nicht hier frisch gelesen wird: auf dem Handy
  // feuert touchstart vor dem click des Knopfes und hat lastSeen längst auf
  // jetzt gesetzt. Der Zeitpunkt gehört zur Frage, nicht zur Antwort.
  function resolveAsk(choice, now, trimAt) {
    const running = S().loadRunning();
    if (!running) return { ok: true };
    const cfg = S().loadConfig();

    if (choice === 'full') {
      // Zeitpunkt merken: ab hier läuft ein neuer Abschnitt, nach dem wieder
      // gefragt wird und ab dem die harte Obergrenze zählt.
      running.asked = true;
      running.confirmedAt = M().toLocalIso(now);
      running.lastSeen = M().toLocalIso(now);
      return S().saveRunning(running);
    }

    if (choice === 'trim') {
      const ziel = new Date(trimAt || running.lastSeen || running.start);
      const res = beende(running, ziel, 'trimmed', cfg);
      if (!res.ok) return res;
      S().clearRunning();
      return { ok: true };
    }

    if (choice === 'edit') {
      const res = beende(running, now, 'manual', cfg);
      if (!res.ok) return res;
      S().clearRunning();
      const letzter = res.entries.length ? res.entries[res.entries.length - 1] : null;
      return {
        ok: true,
        entryId: letzter ? letzter.id : null,
        dateKey: letzter ? M().dateKeyOf(letzter.start) : null
      };
    }

    return { ok: false, error: 'Unbekannte Antwort: ' + choice };
  }

  /* ── Nachträge und Korrekturen ──────────────────────────────── */

  function ladeOderLege(dateKey, config) {
    let rec = S().loadDay(dateKey);
    if (!rec) {
      const snap = M().snapshotRules(dateKey, config);
      rec = { target: snap.target, mins: snap.mins, entries: [] };
    }
    return rec;
  }

  function ueberschneidungsText(treffer, config) {
    const cat = (config.categories || []).filter(c => c.id === treffer.cat)[0];
    const name = cat ? cat.name : treffer.cat;
    const von = new Date(treffer.start), bis = new Date(treffer.end);
    const hhmm = d => ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return `Überschneidet sich mit ${name} ${hhmm(von)}–${hhmm(bis)}`;
  }

  // Die laufende Uhr steht noch in keinem Tagesobjekt. Für die
  // Überlappungsprüfung wird sie als virtueller Eintrag ergänzt — sonst
  // lässt sich dieselbe Wanduhrzeit zweimal buchen (Spec §6.1, A2).
  function mitLaufender(rec, dateStr, now) {
    const liste = (rec && rec.entries) ? rec.entries.slice() : [];
    const running = S().loadRunning();
    if (!running) return liste;
    const ende = now ? M().toLocalIso(now) : running.lastSeen;
    const virtuell = { id: '__laufend__', cat: running.cat, start: running.start, end: ende };
    M().splitAtMidnight(virtuell).forEach(teil => {
      if (M().dateKeyOf(teil.start) === dateStr) liste.push(teil);
    });
    return liste;
  }

  function addManual(dateStr, catId, startIso, endIso, now) {
    const cfg = S().loadConfig();
    const kandidat = { id: neueId(now || new Date()), cat: catId, start: startIso, end: endIso, src: 'manual' };
    if (M().entryMinutes(kandidat) <= 0) {
      return { ok: false, error: 'Das Ende liegt vor dem Start.' };
    }
    const rec = ladeOderLege(dateStr, cfg);
    kandidat.id = freieId(rec, kandidat.id);
    const treffer = M().overlapOf(kandidat, mitLaufender(rec, dateStr, now));
    if (treffer) return { ok: false, error: ueberschneidungsText(treffer, cfg) };
    rec.entries.push(kandidat);
    return S().saveDay(dateStr, rec);
  }

  function editEntry(dateStr, id, patch, now) {
    const cfg = S().loadConfig();
    const rec = S().loadDay(dateStr);
    if (!rec) return { ok: false, error: 'Für diesen Tag gibt es keine Einträge.' };
    const idx = rec.entries.findIndex(e => e.id === id);
    if (idx === -1) return { ok: false, error: 'Eintrag nicht gefunden.' };

    const neu = Object.assign({}, rec.entries[idx], patch, { src: 'manual' });
    if (M().entryMinutes(neu) <= 0) return { ok: false, error: 'Das Ende liegt vor dem Start.' };
    const treffer = M().overlapOf(neu, mitLaufender(rec, dateStr, now));
    if (treffer) return { ok: false, error: ueberschneidungsText(treffer, cfg) };

    rec.entries[idx] = neu;
    return S().saveDay(dateStr, rec);
  }

  function deleteEntry(dateStr, id) {
    const rec = S().loadDay(dateStr);
    if (!rec) return { ok: false, error: 'Für diesen Tag gibt es keine Einträge.' };
    const idx = rec.entries.findIndex(e => e.id === id);
    if (idx === -1) return { ok: false, error: 'Eintrag nicht gefunden.' };
    rec.entries.splice(idx, 1);
    return S().saveDay(dateStr, rec);
  }

  return {
    start: start,
    stop: stop,
    touch: touch,
    checkOnVisible: checkOnVisible,
    resolveAsk: resolveAsk,
    addManual: addManual,
    editEntry: editEntry,
    deleteEntry: deleteEntry
  };
})();
