# Schaff was! — Design

**Datum:** 2026-11-03
**Status:** Entwurf zur Abnahme
**Repo:** `C:\GitHub\SchaffWas` → GitHub `MartinKammler/SchaffWas` (öffentlich, neu anzulegen)
**Auslieferung:** GitHub Pages unter `martinkammler.github.io/SchaffWas/`

---

## 1. Worum es geht und warum

Martin ist arbeitslos und braucht einen Grund, morgens nicht bei YouTube und
Netflix zu landen. "Schaff was!" ist eine **Stempeluhr** — keine To-do-App,
kein Produktivitätssystem. Du drückst einen Knopf, die Uhr läuft, und am Ende
des Tages steht da eine Zahl, die entweder stolz oder peinlich ist.

Die Zahl, um die sich alles dreht: **4 Stunden am Tag irgendwas Sinnvolles
tun.** Die Kategorien (Haushalt, Bewerbungen/Jobsuche, Verein, Umbau, …) sind
nur die Töpfe, in die diese Zeit läuft. Sie sind nicht das Ziel — das Ziel ist
die Tagessumme.

Damit sich der Tag nicht mit der bequemsten Kategorie schönrechnen lässt, gibt
es zusätzlich **Mindestzeiten pro Kategorie** — je Kategorie entweder pro Tag
oder pro Woche (siehe 6.2).

Der Ton ist **frech**, nicht freundlich oder therapeutisch. Das Logo wird eine
"faule Sau". Die App zieht dich auf, wenn du nichts tust, und sagt genau einmal
etwas Anerkennendes, wenn du fertig bist. Das ist Absicht und keine
Geschmacksfrage: eine freundliche App dieser Art würde Martin ignorieren.

**Erfolg sieht so aus:** Martin öffnet sie morgens von sich aus, stempelt den
Tag durch, und die 4 Stunden stehen abends da. Mehr nicht.

---

## 2. Ziele

- **G1** Ein Druck = Zeit läuft. Starten und stoppen muss in unter 2 Sekunden
  erledigt sein, einhändig, auf dem Handy.
- **G2** Das Tagessoll (Standard 4 h) ist die dominante Information auf dem
  Hauptschirm.
- **G3** Mindestzeiten pro Kategorie verhindern Schönrechnen, ohne jeden Tag
  jede Kategorie zu erzwingen.
- **G4** Tagessoll pro Wochentag konfigurierbar (Mo–Fr 4 h, Sa 0 h, So 0 h —
  oder was auch immer).
- **G5** Kategorien, Soll, Minima und Verhalten über einen
  Einstellungs-Screen pflegbar, zusätzlich als JSON exportier- und
  importierbar.
- **G6** Falsche Zeiten lassen sich nachträglich korrigieren und vergessene
  Zeiten nachtragen.
- **G7** Die App verhindert erfundene Zeiten durch durchlaufende Uhren, **ohne**
  echte Arbeitszeit zu verschlucken (siehe 6.4).
- **G8** Funktioniert offline, installierbar als PWA, Daten liegen lokal auf
  dem Gerät.
- **G9** Der freche Ton ist Teil des Produkts, nicht Dekoration — die Sprüche
  reagieren auf die Tageslage.

## 3. Nicht-Ziele (bewusst draußen, v1)

- **Keine Aufgaben-/To-do-Listen.** Kategorien, keine Einzelaufgaben.
- **Keine WebDAV-Synchronisation in v1.** Später denkbar (siehe §10), die
  Datenstruktur wird darauf vorbereitet, aber nichts davon wird jetzt gebaut.
- **Kein Backend, kein Konto, kein Login, kein PIN.** Eine Person, ein Gerät.
  Folge daraus: **keine Hintergrund-Benachrichtigungen** (siehe 6.4.2).
- **Kein Mehrbenutzerbetrieb.**
- **Kein Nachweis-Export für Behörden/Jobcenter.** Die App ist Motivation,
  keine Beweisführung.
- **Keine Kalender-, Health- oder Fremd-App-Anbindung.**
- **Keine Gamification-Schicht** über Serien hinaus: keine Punkte, keine
  Abzeichen, keine Level, kein Shop.
- **Keine Release-Maschinerie in v1** — kein `make-release.ps1`, keine
  ZIP-Artefakte, kein `RELEASE_NOTES.md`. Nur `version.js`, `CHANGELOG.md` und
  `git push`. *(Meine Entscheidung; kann später aus LifeguardClock übernommen
  werden.)*

## 4. Anti-Ziele (würde das Projekt scheitern lassen, auch wenn es läuft)

- **A1 Die App fühlt sich wie Arbeit an.** Wenn Stempeln mehr als zwei
  Handgriffe braucht oder man Formulare füllt, verliert sie gegen die Couch.
- **A2 Selbstbetrug ist einfach.** Eine Uhr, die 6 Stunden "Haushalt" bucht,
  während Netflix läuft, macht die Zahl wertlos — und damit die ganze App.
- **A3 Die App nervt.** Benachrichtigungs-Spam oder Dauer-Gemecker führt dazu,
  dass sie deinstalliert wird. Frech ≠ aufdringlich.
- **A4 Datenverlust.** Eine Stempeluhr, die die Woche verliert, wird nicht
  wieder geöffnet. Dazu gehört auch: **rückwirkend** entwertete Tage, weil man
  an den Einstellungen gedreht hat (siehe 7.2).
- **A5 Freundlich und brav.** Ein weichgespülter Ton macht sie austauschbar.
- **A6 Echte Arbeit wird verschluckt.** Zwei Stunden putzen mit dem Handy in
  der Tasche müssen zählen. Eine Schutzregel, die diese Zeit wegwirft, ist
  schlimmer als keine.

---

## 5. Rahmenbedingungen

- **Plattform:** PWA, **primär Smartphone** (Android, Portrait), sekundär
  Desktop-Browser. Dunkles Design.
- **Auslieferung:** öffentliches Repo `MartinKammler/SchaffWas`, GitHub Pages.
  HTTPS ist Voraussetzung für Service Worker und Installation; `file://`
  funktioniert ausdrücklich nicht und wird nicht unterstützt.
  - `start_url` und alle Pfade im Manifest und im Service Worker **relativ**
    (`./`), damit die App unter dem Unterpfad `/SchaffWas/` läuft.
  - Der Service-Worker-Cache trägt ein eigenes Präfix (`sw-shell-`) und räumt
    nur eigene Caches auf — unter derselben Herkunft liegen weitere Apps
    (LifeguardClock, LifeguardCount). Dasselbe gilt für `localStorage`: Präfix
    `sw_`, nichts Fremdes anfassen.
  - Push-Anleitung: Das Repo liegt unter `MartinKammler`, also vor dem Push
    `gh auth switch --user MartinKammler`, danach zurück auf
    `DoomsdayGoddy` (globale Regel aus CLAUDE.md).
- **Stack — meine Entscheidung, Vorbild LifeguardClock** (`C:\GitHub\LifeguardClock`):
  - Vanilla HTML/CSS/JS, **kein Build-Schritt, kein Framework, kein npm zur
    Laufzeit**.
  - `manifest.json` + `sw.js` (Service Worker) für Installierbarkeit und
    Offline-Betrieb.
  - `version.js` als einzige Quelle der App-Version; der Service-Worker leitet
    seinen `CACHE_NAME` daraus ab (`importScripts('./version.js')`), genau wie
    bei LifeguardClock.
  - Tests: `node run-tests.mjs` mit `puppeteer-core` als einzige
    Dev-Abhängigkeit — dasselbe Muster wie LifeguardClock.
  - Begründung: Martin wartet das selbst, und die WebDAV-Schicht aus
    LifeguardClock ist später übertragbar.
- **Speicherung:** `localStorage`, Präfix `sw_`. Monatsweise aufgeteiltes
  Protokoll (`sw_log_YYYY-MM`), damit einzelne Schlüssel klein bleiben —
  Muster von LifeguardClock (`lgc_log_${month}`).
- **Sprache:** Oberfläche komplett Deutsch, Du-Form.
- **Keine externen CDNs, keine Tracker, keine Fremd-Fonts** — alles liegt im
  Repo, sonst bricht der Offline-Betrieb.

---

## 6. Die Mechanik (entschieden)

### 6.1 Stempeln

- Es läuft **immer nur eine Kategorie gleichzeitig**. Start auf einer anderen
  Kategorie stoppt die laufende und startet die neue in derselben Aktion.
- Start/Stopp sitzt direkt in der Kategorie-Zeile des Hauptschirms.
- Die Uhr rechnet **über Zeitstempel, nicht über einen laufenden Zähler**: Ein
  laufender Eintrag wird mit seinem Startzeitpunkt persistiert
  (`sw_running`), damit App-Schließen, Bildschirmsperre, Browser-Neustart und
  Handy-Tiefschlaf die Zeit nicht verfälschen. Beim Öffnen wird aus
  `jetzt − start` weitergerechnet.
- Zeiten werden **sekundengenau erfasst**, in der Oberfläche minutengenau
  angezeigt (laufende Kategorie: `mm:ss`).
- **Überlappungen sind nicht erlaubt.** Beim Speichern eines manuellen oder
  geänderten Eintrags prüft die App, ob er sich mit einem bestehenden Eintrag
  desselben Tages zeitlich überschneidet, und lehnt ihn mit Klartext-Meldung ab
  ("Überschneidet sich mit Bewerbungen 10:00–10:45"). Sonst zählt dieselbe
  Wanduhrzeit doppelt aufs Tagessoll — A2 durch die Hintertür.
  *(Meine Entscheidung.)*

### 6.2 Tagessoll und Minima

- `dayTargets`: je Wochentag ein Soll in Minuten. Standard: Mo–Fr 240, Sa 0,
  So 0.
- Ein Tag mit Soll 0 ist ein **freier Tag**: die Uhr läuft trotzdem, wenn man
  will, es wird aber nichts gefordert, nichts gemeckert, und **die Serie bricht
  dort nicht** (siehe 6.5).
- Jede Kategorie hat ein Minimum aus zwei Teilen: `minMinutes` und
  `minPeriod` (`"day"` oder `"week"`). `minMinutes: 0` heißt: zählt mit, wird
  nicht gefordert.
  - Standard: **Haushalt 30 min/Tag, Bewerbungen 30 min/Tag, Verein
    120 min/Woche, Umbau 120 min/Woche.**
  - Begründung: Verein und Umbau jeden Werktag zu fordern macht den grünen Tag
    praktisch unerreichbar und entwertet damit Serie und Anerkennungsmoment.
- **Tag erfüllt** = Tagessumme ≥ Tagessoll **und** jede aktive Kategorie mit
  `minPeriod: "day"` hat ihr Minimum an diesem Tag erreicht.
  Wochen-Minima gehen **nicht** in die Tageserfüllung ein.
- **Woche erfüllt** = alle Tage der Woche erfüllt **und** jede aktive Kategorie
  mit `minPeriod: "week"` hat ihr Minimum in dieser Woche erreicht. Die Woche
  läuft Montag bis Sonntag. Sie wird nur in der Historie bewertet und bricht
  keine Tagesserie.
- Auf dem Hauptschirm zeigen Kategorien mit Wochen-Minimum ihren
  **Wochenstand** ("1:30 / 2:00 diese Woche"), Kategorien mit Tagesminimum
  ihren Tagesstand ("27 / 30 min heute").
- Kein Deckel nach oben: 2 h Haushalt zählen voll aufs Tagessoll. Es gibt kein
  Stunden-Soll pro Kategorie (ausdrückliche Korrektur gegenüber dem ersten
  Entwurf).

### 6.3 Tagesgrenze

- Ein Tag läuft von **00:00 bis 24:00** lokaler Zeit.
- Läuft um Mitternacht eine Uhr, wird der Eintrag **an der Tagesgrenze
  geteilt**: der erste Teil zählt für den alten Tag, die Uhr läuft im neuen Tag
  weiter. (Meine Entscheidung — ein konfigurierbarer Tagesbeginn, z. B. 04:00,
  ist bewusst nicht in v1.)

### 6.4 Erfundene Zeiten verhindern, echte Zeiten retten

Der Normalfall auf dem Handy ist: Uhr starten, Handy wegstecken, zwei Stunden
arbeiten, App wieder öffnen. In dieser Zeit gibt es **keine** Interaktion. Eine
Regel, die stumme Zeit einfach abschneidet, würde genau die Arbeit wegwerfen,
die gemessen werden soll (A6). Deshalb gilt:

#### 6.4.1 Rückfrage beim Wiederöffnen

- Die Uhr läuft weiter, solange sie läuft — auch bei gesperrtem Bildschirm und
  geschlossener App. Es wird **nichts automatisch im Hintergrund abgeschnitten**.
- Überschreitet ein laufender Eintrag `askAfterMinutes` (Standard 90), zeigt die
  App **beim nächsten Sichtbarwerden** genau eine Rückfrage:
  > "Haushalt läuft seit 2:10 — echt?"
  > **[Ja, voll buchen] [Nur bis 09:32 (letzte Berührung)] [Zeit selbst eintragen]**
- "Voll buchen" beendet nichts — die Uhr läuft weiter, die Frage ist für diesen
  Eintrag beantwortet (`asked: true`) und kommt nicht wieder.
- "Nur bis letzte Berührung" stoppt den Eintrag zum Zeitpunkt `lastSeen` und
  markiert ihn `src: "trimmed"`.
- "Selbst eintragen" stoppt den Eintrag und öffnet ihn direkt im Editor.
- **Rechenreihenfolge beim Sichtbarwerden** (wichtig, sonst feuert die Regel
  nie oder verschluckt jede Pause): erst `sw_running` lesen und mit dem **alten**
  `lastSeen` prüfen, ob die Rückfrage fällig ist, dann `lastSeen` auf jetzt
  setzen. Nicht umgekehrt.
- `lastSeen` wird bei jeder Interaktion und bei jedem `visibilitychange` auf
  sichtbar aktualisiert.
- **Harte Obergrenze:** Läuft ein Eintrag über `hardStopMinutes` (Standard 600 =
  10 h) **und** ist die Rückfrage unbeantwortet, wird er bei `lastSeen` beendet
  und `src: "autostop"` markiert. Das ist der Schutz gegen die durchlaufende
  Nacht, nicht der Normalweg.

#### 6.4.2 Erinnerung — nur im Vordergrund

- Nach `reminderMinutes` (Standard 45) Laufzeit erscheint, **solange die App
  offen ist**, ein unaufdringliches Banner: "Läuft die Uhr noch, oder du?"
  Höchstens eines pro laufendem Eintrag (gegen A3).
- **Benachrichtigungen aus dem Hintergrund gibt es nicht.** Web Push braucht
  einen Server (per §3 ausgeschlossen), die Chrome-API für geplante
  Benachrichtigungen (`TimestampTrigger`) ist nicht verfügbar, und Timer im
  Service Worker überleben das Einschlafen des Geräts nicht. Statt
  halbfunktionierendem Code: gar keiner. Das Banner plus die Rückfrage aus
  6.4.1 decken den Zweck ab.
- Die Notification-API wird **nicht** verwendet, es wird **kein**
  Benachrichtigungsrecht abgefragt.

#### 6.4.3 Nachträglich korrigieren

- Im Tagesprotokoll ist jeder Eintrag antippbar: Start/Ende ändern, Kategorie
  wechseln, löschen. Ebenso **manuell nachtragen** ("1 h Haushalt vergessen zu
  stempeln").
- Geänderte und nachgetragene Einträge werden als `manual` markiert und bleiben
  im Protokoll als solche erkennbar.
- Überlappungsprüfung wie in 6.1.

### 6.5 Serie (Streak)

- Die Serie zählt **aufeinanderfolgende Tage mit Soll ≥ 1, an denen der Tag
  erfüllt wurde**. Tage mit Soll 0 werden übersprungen, ohne die Serie zu
  brechen oder zu verlängern.
- Der heutige, noch unfertige Tag bricht die Serie nicht — sie bricht erst,
  wenn ein Tag mit Soll vorbei ist und nicht erfüllt wurde.
- Anzeige unten am Hauptschirm (`🔥 3 Tage`) und in der Historie.
- Das ist die **einzige** Gamification. Keine Punkte, keine Abzeichen.

### 6.6 Der Ton

- Oben am Hauptschirm steht **ein** Spruch, der zur Lage passt. Er wechselt
  beim Öffnen und bei Zustandswechseln, nicht sekündlich.
- Die Sprüche liegen in Pools, ausgewählt nach Zustand. Mindestens diese
  Zustände, je **8–12 Sprüche**, damit es sich nicht abnutzt:
  `tag_frisch` (0 %), `kaum_was` (< 25 %), `unterwegs` (25–75 %),
  `kurz_davor` (75–99 %), `soll_erfuellt`, `minimum_fehlt` (Tagessoll erreicht,
  aber eine Tages-Kategorie unter Minimum), `woche_hinkt` (Wochen-Minimum einer
  Kategorie liegt am Donnerstag noch unter der Hälfte), `spaet_und_wenig` (nach
  18 Uhr und < 50 %), `freier_tag`, `serie_gebrochen`.
- Tonlage: **frech bis grob, duzend, kurz.** Beispiele aus den Mockups:
  "Moin, faule Sau. 0 von 4 Stunden. Netflix kann warten.",
  "1 von 4 Stunden. Die Couch gewinnt nach Punkten.",
  "4:15 geschafft. Heute warst du keine faule Sau."
  Grenze: zieht auf, beleidigt aber nicht die Person in ihrer Lage —
  keine Sprüche über Arbeitslosigkeit, Geld oder Hartz IV als Vorwurf. Faulheit
  ja, Existenz nein.
- Die Sprüche stehen in einer eigenen Datei (`taunts.js`) und sind im
  Config-JSON überschreibbar, damit Martin eigene nachlegen kann, ohne Code
  anzufassen. *(Meine Entscheidung.)*

---

## 7. Datenmodell

JSON, in `localStorage`. Alle Zeitangaben lokal, ISO-8601 mit Offset.

### 7.1 Konfiguration — `sw_config`

```json
{
  "schemaVersion": 1,
  "dayTargets": { "mon": 240, "tue": 240, "wed": 240, "thu": 240, "fri": 240, "sat": 0, "sun": 0 },
  "categories": [
    { "id": "haushalt",  "name": "Haushalt",    "color": "#f0b429", "minMinutes": 30,  "minPeriod": "day",  "active": true },
    { "id": "bewerbung", "name": "Bewerbungen", "color": "#e8a317", "minMinutes": 30,  "minPeriod": "day",  "active": true },
    { "id": "verein",    "name": "Verein",      "color": "#7aa2f7", "minMinutes": 120, "minPeriod": "week", "active": true },
    { "id": "umbau",     "name": "Umbau",       "color": "#bb7af7", "minMinutes": 120, "minPeriod": "week", "active": true }
  ],
  "reminderMinutes": 45,
  "askAfterMinutes": 90,
  "hardStopMinutes": 600,
  "taunts": null
}
```

- `id` ist stabil und wird nie wiederverwendet; Umbenennen ändert nur `name`.
- `active: false` blendet eine Kategorie aus, **ohne** ihre Historie zu
  löschen. Inaktive Kategorien zählen nicht in die Minimum-Prüfung.
- `taunts: null` = eingebaute Sprüche; ein Objekt derselben Form wie in
  `taunts.js` ersetzt sie.

### 7.2 Protokoll — `sw_log_YYYY-MM`

Pro Tag die Einträge **plus ein Abzug der Vorgaben, die an diesem Tag galten.**
Ohne diesen Abzug würde eine spätere Änderung an Soll oder Minima alte,
erfüllte Tage rückwirkend ungültig machen und die Serie nachträglich brechen —
genau das, was A4 verhindern soll. *(Meine Entscheidung.)*

```json
{
  "2026-11-03": {
    "target": 240,
    "mins": { "haushalt": [30, "day"], "bewerbung": [30, "day"], "verein": [120, "week"], "umbau": [120, "week"] },
    "entries": [
      { "id": "e1", "cat": "haushalt",  "start": "2026-11-03T09:05:11+01:00", "end": "2026-11-03T09:32:25+01:00", "src": "timer" },
      { "id": "e2", "cat": "bewerbung", "start": "2026-11-03T10:00:00+01:00", "end": "2026-11-03T10:45:00+01:00", "src": "manual" }
    ]
  }
}
```

- `target` und `mins` werden beim **ersten** Eintrag des Tages aus der Config
  kopiert und danach nicht mehr angefasst.
- Ein Tag ohne Einträge hat keinen Schlüssel; für die Bewertung solcher Tage
  (und für die Vorschau des heutigen Tages) gilt die aktuelle Config.
- `src`: `timer` | `manual` | `autostop` | `trimmed`.

### 7.3 Laufender Eintrag — `sw_running`

```json
{
  "cat": "haushalt",
  "start": "2026-11-03T09:05:11+01:00",
  "lastSeen": "2026-11-03T09:30:02+01:00",
  "reminded": false,
  "asked": false
}
```

`lastSeen` wird bei jeder Interaktion und bei jedem Sichtbarwerden der Seite
aktualisiert (Reihenfolge: siehe 6.4.1). `asked` merkt, dass die Rückfrage für
diesen Eintrag beantwortet wurde.

### 7.4 Export / Import

- **Export:** eine Datei `schaffwas-backup-YYYY-MM-DD.json` mit `config` und
  **allen** Protokoll-Monaten sowie `appVersion` und `exportedAt`.
- **Import:** dieselbe Datei. Zwei Wege: ganze Datei (ersetzt alles, mit
  deutlicher Rückfrage) oder nur der `config`-Teil. Vor jedem Import wird die
  Validität geprüft; bei Fehlern wird **nichts** geschrieben und der Fehler im
  Klartext angezeigt (gegen A4).
- Zusätzlich gibt es im Einstellungs-Screen ein Textfeld, in das man das
  Config-JSON direkt einfügen kann — damit ist Martins Wunsch "ich will das in
  einem JSON einstellen können" ohne Dateiverwaltung am Handy erfüllt.

### 7.5 Schutz gegen Datenverlust

*(Meine Entscheidung, bewusst sparsam, damit es nicht nervt — A3.)*

- Beim ersten Start einmal `navigator.storage.persist()` anfordern; Ergebnis in
  den Einstellungen anzeigen ("Speicher: dauerhaft / kann vom Browser geräumt
  werden").
- In den Einstellungen steht neben dem Export-Knopf, wann zuletzt exportiert
  wurde ("letzter Export: vor 12 Tagen"). Liegt das über 14 Tage zurück,
  erscheint diese Zeile zusätzlich dezent am Fuß des Hauptschirms — als Zeile,
  nicht als Popup.
- Mehr nicht: keine automatische Spiegelung, kein zweiter Speicher. Das Risiko
  (Browserdaten löschen, PWA neu installieren) steht im README.

---

## 8. Logo, Farben, Icons

Das Logo liegt in drei Teilen im Repo-Wurzelverzeichnis vor — Comic-Sticker mit
weißem Rand, fettes Schwein mit Sonnenbrille und Herzchen-Boxershorts auf
braunem Sofa, Popcornschale und Bierflasche daneben, darüber "Schaff was!" in
Rot auf gelbem Knall:

| Datei | Inhalt | Format |
|---|---|---|
| `Logo.png` | Schwein **mit** Schriftzug, der komplette Sticker | 893×893, transparent |
| `Logo-Sau.png` | nur das Schwein auf dem Sofa | 893×893, transparent |
| `Logo-Schriftzug.png` | nur der Schriftzug "Schaff was!" | 1243×1243, **ohne Transparenz, weißer Grund** |

*(Die folgenden Festlegungen sind meine Entscheidung.)*

- **`Logo-Schriftzug.png` muss vor der Verwendung freigestellt werden** — als
  RGB-Datei mit weißem Grund setzt es sonst einen weißen Kasten auf den dunklen
  Hintergrund. Das Ergebnis ersetzt die Datei im Repo.
- **Kopfzeile des Hauptschirms:** kein doppelter Titel. Oben links
  `Logo-Sau.png` klein (ca. 44 px), rechts daneben der Spruch. Der Schriftzug
  (`Logo-Schriftzug.png`) erscheint groß auf dem Startbild und im
  Einstellungs-Screen; der vollständige Sticker `Logo.png` nur dort, wo Platz
  ist (Startbild, "Über die App").
- **App-Icon (`Logo-icon.png`, 512×512):** der volle Sticker ist bei 48 px
  unlesbar. Icon wird ein **enger Ausschnitt aus `Logo-Sau.png` auf Kopf,
  Sonnenbrille und Oberkörper** auf gelbem Grund (`#f7d038`), ohne Text.
  Maskable-Variante (`Logo-icon-maskable.png`) mit ca. 10 % Innenabstand, damit
  Android nichts abschneidet.
- **Farben** — abgeleitet aus dem Logo, passt zu den Mockups:
  | Zweck | Farbe |
  |---|---|
  | Hintergrund | `#15181d` (Flächen `#1d2127`, Linien `#2c313a`) |
  | Akzent / laufende Uhr | `#f0b429` (Logo-Gelb) |
  | Warnung / Stopp | `#e3342f` (Logo-Rot) |
  | Erfüllt | `#38c172` |
  | Kategorie-Farben (Standard) | `#f0b429`, `#e8a317`, `#7aa2f7` (Sofa-Blau), `#bb7af7` |
  | `theme_color` / `background_color` im Manifest | `#15181d` |
- **Das Schwein reagiert:** beim unerfüllten Tag liegt `Logo-Sau.png` da wie
  es ist. Ist der Tag erfüllt, wird dieselbe Grafik leicht gedreht und grün
  umrandet dargestellt ("Sau steht auf") — kein zweites Bild nötig, solange
  keins existiert. Falls Martin später eine zweite Pose liefert (Schwein
  steht/wischt), ersetzt die das.

---

## 9. Oberfläche

Vier Screens, Navigation unten. Dunkles Design, große Flächen,
einhandtauglich. Die Mockups der Brainstorming-Sitzung liegen unter
`docs/superpowers/specs/mockups/` (Variante C, nachgeschärft, Datei
`02-hauptschirm-final.html`) und sind die verbindliche Richtung für Screen 1 —
mit einer Abweichung: die Kategorie-Zeilen zeigen je nach `minPeriod` Tages-
oder Wochenstand.

1. **Hauptschirm** — der einzige Screen, der im Alltag zählt.
   - Kopf: Logo (faule Sau) + "Schaff was!", darunter der Spruch.
   - Dann groß: **Tagessumme / Tagessoll** (`1:12 / 4:00`), darunter ein
     einziger Balken für den Tag, in Kategorie-Farben gestapelt, plus
     Restangabe ("2:48 fehlen").
   - Darunter je Kategorie eine kompakte Zeile: Farbpunkt, Name,
     Minimum-Stand ("27 / 30 min heute" bzw. "1:30 / 2:00 diese Woche" bzw.
     "Minimum erfüllt ✓"), gelaufene Zeit, Start-/Stopp-Knopf. Die laufende
     Zeile ist hervorgehoben und zeigt `mm:ss`.
   - Fuß: Serie und Wochensumme.
   - Ist der Tag erfüllt, kippt der Kopfbereich sichtbar auf grün — einmal
     Anerkennung, dann Ruhe.
2. **Tagesprotokoll** — Liste der Einträge des Tages, Einträge bearbeiten,
   löschen, nachtragen; Tag per Wischen/Datum wechseln. Einträge mit
   `src: manual | trimmed | autostop` sind erkennbar markiert.
3. **Historie** — Woche und Monat: erfüllte Tage, Tagessummen,
   Kategorie-Verteilung, erfüllte Wochen-Minima, Serie. Bewusst schlicht;
   keine Diagramm-Spielwiese.
4. **Einstellungen** — Kategorien (anlegen, umbenennen, Farbe, Minimum +
   Zeitraum, aktiv/inaktiv, Reihenfolge), Tagessoll je Wochentag,
   Rückfrage-Zeit, harte Obergrenze, Erinnerungs-Zeit, Speicher-Status,
   JSON-Export/-Import, Config-Textfeld, App-Version.

---

## 10. Vorbereitung für später (nicht bauen)

WebDAV-Sync wie bei LifeguardClock ist ausdrücklich "nicht ausgeschlossen,
aber erstmal optional". Damit das später nicht zum Umbau wird, gilt jetzt nur:

- Der gesamte Zustand ist serialisierbares JSON mit `schemaVersion`, und das
  Protokoll ist monatsweise getrennt (kleine, selten geänderte Einheiten).
- Jeder Schreibvorgang aktualisiert einen Zeitstempel `sw_last_change`.
- Lesen und Schreiben des Zustands laufen über **eine** Speicher-Schicht
  (`storage.js`), nicht verstreut über die App.

Mehr nicht. Kein Sync-Code, keine Konfliktlogik, keine Zugangsdaten in v1.

---

## 11. Was dem Builder überlassen bleibt

- Dateiaufteilung im Detail, Namen der Funktionen, CSS-Struktur.
- Umsetzung der gestapelten Tagesbalken-Darstellung und der Animationen.
- Umfang und Zuschnitt der Tests, solange `node run-tests.mjs` den
  Kernpfad abdeckt: Stempeln über Zeitstempel, Tagesgrenzen-Teilung,
  Tagessoll- und Minimum-Berechnung (Tag und Woche), Serien-Berechnung mit
  freien Tagen, Rückfrage-Logik samt Rechenreihenfolge aus 6.4.1,
  Überlappungs-Ablehnung, Import-Validierung, Bewertung alter Tage gegen ihren
  gespeicherten Abzug.
- Konkrete Formulierung der Sprüche innerhalb der Tonlage aus 6.6.
- Zuschnitt des Icon-Ausschnitts aus `Logo.png` und Erzeugung der
  Icon-Dateien in den nötigen Größen (siehe §8).
- Reihenfolge der Umsetzung; sinnvoll ist Hauptschirm + Stempel-Kern zuerst,
  damit die App früh benutzbar ist.
