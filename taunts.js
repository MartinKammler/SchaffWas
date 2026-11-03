/* taunts.js — der Ton der App.
   Frech, duzend, kurz. Grenze (Spec §6.6): Faulheit wird aufgezogen,
   die Lage nicht. Keine Sprüche über Arbeitslosigkeit, Geld oder Ämter.
   Eigene Sprüche gehen über config.taunts, ohne Code anzufassen. */
window.SW = window.SW || {};

SW.taunts = (function () {

  const POOLS = {
    tag_frisch: [
      'Moin, faule Sau. 0 von 4 Stunden. Netflix kann warten.',
      'Noch nichts. Beeindruckend konsequent.',
      'Der Tag ist jung. Du leider auch nicht mehr. Los.',
      'Null Minuten. Die Couch führt ohne Gegentor.',
      'Aufstehen zählt nicht als Kategorie.',
      'Frisch geduscht und schon erschöpft, was?',
      'Der Tag wartet nicht, bis du Lust hast.',
      'Du hast heute noch nichts versaut. Fang wenigstens an.',
      'Vier Stunden. Nicht vier Tage. Bewegung.',
      'Die Uhr steht. Rate mal, woran das liegt.'
    ],
    kaum_was: [
      '1 von 4 Stunden. Die Couch gewinnt nach Punkten.',
      'Immerhin angefangen. Jetzt nicht wieder hinlegen.',
      'Das war der Aufwärmteil, ja?',
      'Ein bisschen was ist weniger als wenig.',
      'Du hast angefangen. Respekt. Jetzt mach auch weiter.',
      'In dem Tempo bist du Freitag fertig. Mit heute.',
      'Nett. Reicht aber nicht.',
      'Die Sau auf dem Sofa lacht noch.',
      'Weiter. Das war kaum der Rede wert.',
      'Ein Anfang ist gemacht. Ein Anfang.'
    ],
    unterwegs: [
      'Läuft. Erstaunlich.',
      'Du bist dabei. Bleib dabei.',
      'Halbzeit-Gefühl ohne Halbzeit-Leistung. Weiter.',
      'Sieht nach einem anständigen Tag aus. Noch.',
      'Nicht nachlassen, die zweite Hälfte ist die zähe.',
      'Du machst das gerade echt. Verrückt.',
      'Weiter so, dann wird das heute noch was.',
      'Ordentlich unterwegs. Noch ein ordentliches Stück vor dir.',
      'Das Sofa guckt zu und wartet auf deinen Fehler.',
      'Gut. Und jetzt die unbequeme Kategorie.'
    ],
    kurz_davor: [
      'Fast. Jetzt nicht abdrehen.',
      'Der letzte Rest ist immer der längste. Durch.',
      'So kurz vor Schluss aufhören wäre richtig peinlich.',
      'Noch ein Stück. Dann darfst du dich fallen lassen.',
      'Du riechst das Sofa schon. Noch nicht.',
      'Letzte Runde. Nicht spazieren, laufen.',
      'Gleich geschafft. Gleich heißt nicht jetzt.',
      'Die Zielgerade. Da hat schon mancher geschlafen.',
      'Beiß durch, es sind nur noch Minuten.',
      'Jetzt abbrechen und der ganze Tag war Deko.'
    ],
    soll_erfuellt: [
      'Geschafft. Heute warst du keine faule Sau.',
      'Soll steht. Sofa freigegeben.',
      'Vier Stunden. Du kannst es ja doch.',
      'Fertig. Jetzt darfst du glotzen, ohne dich zu schämen.',
      'Tagessoll erfüllt. Morgen wieder, nicht übermütig werden.',
      'Sauber durchgezogen. Popcorn ist verdient.',
      'Erledigt. Das Sofa hat heute verloren.',
      'Alles drin. Feierabend, ehrlich verdient.',
      'Das war ein ganzer Tag. Gut gemacht.',
      'Soll voll. Ausnahmsweise mal kein Spruch.'
    ],
    minimum_fehlt: [
      'Stunden stimmen, aber eine Kategorie hast du gedrückt.',
      'Schön gerechnet. Eine fehlt trotzdem.',
      'Vier Stunden derselben Sache sind kein ganzer Tag.',
      'Die Zeit stimmt, die Verteilung nicht.',
      'Du hast dich um eine Kategorie gedrückt. Fällt auf.',
      'Fast sauber. Fast.',
      'Soll erreicht, Mindestmaß verfehlt. Nachsitzen.',
      'Eine Kategorie guckt noch dumm aus der Wäsche.',
      'Lieblingskategorie ist keine Strategie.',
      'Stunden ja, Mindestzeit nein. Nochmal ran.'
    ],
    woche_hinkt: [
      'Die Woche ist halb rum, eine Kategorie quasi unberührt.',
      'Donnerstag. Und das Wochenpensum guckt dich böse an.',
      'Eine Kategorie schiebst du seit Montag vor dir her.',
      'Das holst du Freitag nicht mehr auf, also fang heute an.',
      'Die Woche zählt mit, nicht nur der Tag.',
      'Eine Kategorie hinkt. Du weißt genau welche.',
      'Aufschieben ist auch eine Entscheidung. Eine schlechte.',
      'Rest der Woche: kurz. Rückstand: nicht.',
      'Du spielst auf Zeit und verlierst gerade.',
      'Freitag wird hässlich, wenn du so weitermachst.'
    ],
    spaet_und_wenig: [
      'Abends, und noch nicht mal halb. Das wird nichts mehr.',
      'Der Tag ist fast rum und du auch noch nicht angefangen.',
      'Es ist spät. Deine Bilanz ist spät dran.',
      'Jetzt noch loszulegen wäre sportlich. Mach trotzdem.',
      'Später Abend, magere Ausbeute. Autsch.',
      'Du hast den Tag verdaddelt. Rette, was geht.',
      'Das Sofa hat heute klar nach Punkten gewonnen.',
      'Noch zwei Stunden wach, noch zwei Stunden Chance.',
      'Morgen früher anfangen. Heute wenigstens noch was.',
      'Spät, wenig, und die Uhr läuft weiter.'
    ],
    freier_tag: [
      'Heute ist frei. Ausnahmsweise darfst du Sau sein.',
      'Kein Soll heute. Genieß es, ohne schlechtes Gewissen.',
      'Freier Tag. Die Uhr läuft nur, wenn du willst.',
      'Heute musst du nichts. Wirklich nichts.',
      'Pause ist auch Arbeit. Behaupten jedenfalls die Faulen.',
      'Frei. Aber übertreib es nicht mit dem Nichtstun.',
      'Heute zählt nichts gegen dich. Morgen schon.',
      'Kein Pensum. Leg die Hufe hoch.',
      'Frei heute. Die Serie bleibt trotzdem stehen.',
      'Sofa ohne Gegner. Dein Tag.'
    ],
    serie_gebrochen: [
      'Serie futsch. Gestern hast du dich hängen lassen.',
      'Die Serie ist hin. Fang eine neue an.',
      'Null Tage Serie. Selbst schuld.',
      'Gestern verkackt. Heute die Chance, es zu vergessen.',
      'Serie gerissen. Passiert. Jetzt nicht zweimal.',
      'Die schöne Serie — vorbei. Von vorn.',
      'Ein Tag Pause zu viel. Zurück an die Arbeit.',
      'Serie beendet. Das Sofa feiert noch.',
      'Gestern war schwach. Heute nicht auch noch.',
      'Neuer Anlauf. Diesmal durchhalten.'
    ]
  };

  let letzter = null;

  // Vorrang von oben nach unten (Spec §6.6).
  function stateFor(ctx) {
    const d = ctx.dayStatus || {};
    const w = ctx.weekStatus || { byCat: {} };
    const now = ctx.now || new Date();

    if (d.free) return 'freier_tag';
    if (ctx.streakBroken) return 'serie_gebrochen';
    if (d.fulfilled) return 'soll_erfuellt';

    const target = d.target || 0;
    const anteil = target > 0 ? (d.total || 0) / target : 0;

    if (target > 0 && (d.total || 0) >= target && (d.missing || []).length > 0) return 'minimum_fehlt';
    if (now.getHours() >= 18 && anteil < 0.5) return 'spaet_und_wenig';

    const wochentag = now.getDay(); // 0 = So, 4 = Do
    const abDonnerstag = (wochentag >= 4 || wochentag === 0);
    if (abDonnerstag) {
      const hinkt = Object.keys(w.byCat || {}).some(cat => {
        const m = w.byCat[cat];
        return m && m.need > 0 && m.have < m.need / 2;
      });
      if (hinkt) return 'woche_hinkt';
    }

    if (anteil >= 0.75) return 'kurz_davor';
    if (anteil >= 0.25) return 'unterwegs';
    if ((d.total || 0) > 0) return 'kaum_was';
    return 'tag_frisch';
  }

  function pick(state, config) {
    const eigene = (config && config.taunts) ? config.taunts[state] : null;
    const pool = (Array.isArray(eigene) && eigene.length) ? eigene : (POOLS[state] || POOLS.tag_frisch);
    if (pool.length === 1) { letzter = pool[0]; return pool[0]; }
    let s = pool[Math.floor(Math.random() * pool.length)];
    let versuche = 0;
    while (s === letzter && versuche < 20) {
      s = pool[Math.floor(Math.random() * pool.length)];
      versuche++;
    }
    letzter = s;
    return s;
  }

  return { POOLS: POOLS, stateFor: stateFor, pick: pick };
})();
