# Schaff was! Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine installierbare PWA-Stempeluhr, die Tageszeit in Kategorien bucht, ein Tagessoll von 4 h und Mindestzeiten je Kategorie prüft und frech dazu kommentiert.

**Architecture:** Reine Logik (`storage.js`, `model.js`, `clock.js`, `taunts.js`) ist von der Darstellung getrennt; jeder Screen baut aus der Logik erst ein einfaches View-Model-Objekt und rendert dann daraus. Alle Dateien sind klassische Skripte, die an ein globales `window.SW` hängen — keine ES-Module, weil die Testsuiten per `file://` laufen. Tests sind HTML-Seiten im Muster von LifeguardClock, ausgeführt über `node run-tests.mjs`.

**Tech Stack:** Vanilla HTML/CSS/JS ohne Build-Schritt, Service Worker + Web-App-Manifest, `localStorage`, Node + `puppeteer-core` nur für die Tests.

**Spec:** `docs/superpowers/specs/2026-11-03-schaff-was-design.md`

## Global Constraints

- Kein Build-Schritt, kein Framework, keine Laufzeit-Abhängigkeit. Einzige Dev-Abhängigkeit: `puppeteer-core` (^23.0.0).
- Keine ES-Module in App-Dateien: jede Datei hängt an `window.SW = window.SW || {}`. Tests laden sie per `<script src="../datei.js">`.
- Keine externen CDNs, keine Fremd-Fonts, keine Tracker — alles liegt im Repo.
- Alle Pfade in HTML, Manifest und Service Worker **relativ** (`./`), weil die App unter `/SchaffWas/` läuft.
- `localStorage`-Schlüssel tragen ausnahmslos das Präfix `sw_`; der Service-Worker-Cache das Präfix `sw-shell-`. Fremde Schlüssel und Caches derselben Herkunft (LifeguardClock, LifeguardCount) werden nie angefasst.
- `version.js` ist die einzige Quelle der Version; `sw.js` leitet `CACHE_NAME` per `importScripts('./version.js')` daraus ab.
- Oberfläche komplett Deutsch, Du-Form.
- **Die Notification-API wird nicht verwendet und kein Benachrichtigungsrecht abgefragt** (Spec §6.4.2).
- Farben: Hintergrund `#15181d`, Fläche `#1d2127`, Linie `#2c313a`, Akzent `#f0b429`, Stopp/Warnung `#e3342f`, Erfüllt `#38c172`, Kategorie-Standards `#f0b429`, `#e8a317`, `#7aa2f7`, `#bb7af7`.
- Standardwerte aus der Spec, überall exakt so: Tagessoll Mo–Fr 240, Sa 0, So 0; Haushalt 30/`day`, Bewerbungen 30/`day`, Verein 120/`week`, Umbau 120/`week`; `reminderMinutes` 45, `askAfterMinutes` 90, `hardStopMinutes` 600.
- Zeitstempel werden als lokale ISO-8601-Strings mit Offset gespeichert; gerechnet wird immer über `Date`-Differenzen, nie über Zeichenkettenvergleich.

## Review Focus

Fünf Fälle, die die Spec voraussetzt, aber nicht ausbuchstabiert. Jeder bekommt in der genannten Task einen eigenen Test.

1. **Sommer-/Winterzeit.** Ein Eintrag über die Umstellung (z. B. 2027-03-28 01:30 → 03:30 MEZ→MESZ) darf nur die echte verstrichene Zeit buchen, und der 25-Stunden-Tag im Oktober darf die Tagesgrenzen-Teilung nicht verschieben. → Task 3.
2. **Gerätezeit springt rückwärts.** Ein laufender Eintrag, bei dem `jetzt < start` ist, darf keine negative Dauer buchen und die Tagessumme nicht zerstören. → Task 3 und Task 5.
3. **Kategorie gelöscht oder inaktiv, Historie bleibt.** Einträge mit einer `cat`, die es in der Config nicht mehr gibt, müssen in Summe und Protokoll sichtbar bleiben (als "Unbekannt") und dürfen die Erfüllungsprüfung nicht zum Absturz bringen. → Task 4 und Task 8.
4. **Speicher voll.** Ein `QuotaExceededError` beim Schreiben darf nicht stumm verschluckt werden — der Aufrufer muss einen Fehler bekommen und die Oberfläche ihn anzeigen, sonst ist Arbeit weg (A4). → Task 2.
5. **Kaputtes Import-JSON.** Fehlende Felder, falsche Typen, `null`, Zahlen als Strings: Der Import muss ablehnen und darf **nichts** schreiben — ein halb importierter Zustand ist schlimmer als gar keiner. → Task 2.

---

### Task 1: Projektgerüst, Version, Testrunner

**Files:**
- Create: `package.json`, `version.js`, `run-tests.mjs`, `.gitignore`, `tests/_runner.js`
- Test: `tests/test_version.html`

**Interfaces:**
- Produces: globales `APP_VERSION` (String) aus `version.js`; `tests/_runner.js` stellt `suite(name)`, `test(name, fn)`, `assert(cond, msg)`, `assertEqual(a, b, msg)`, `assertThrows(fn, msg)` und das `#summary`-Ende-Signal (`class="all-pass"` / `class="has-fail"`) bereit, das `run-tests.mjs` ausliest.

- [ ] **Step 1: Repo initialisieren**

```bash
cd C:/GitHub/SchaffWas && git init -b main
```

`.gitignore`: `node_modules/`, `.superpowers/`.

- [ ] **Step 2: `tests/_runner.js` und `run-tests.mjs` anlegen**

Beide aus `C:\GitHub\LifeguardClock` übernehmen: `run-tests.mjs` unverändert (sucht installiertes Edge/Chrome, lädt alle `tests/test_*.html` per `file://`, wartet auf `#summary.all-pass` / `#summary.has-fail`, Exit 1 bei Fehlschlag). Den Mini-Runner, der dort in jeder Testseite dupliziert ist, hier einmalig in `tests/_runner.js` auslagern; er rendert die Ergebnisse nach `#output` und schreibt das Summary-Element.

`package.json`: `"name": "schaffwas"`, `"private": true`, `"scripts": { "test": "node run-tests.mjs" }`, `"devDependencies": { "puppeteer-core": "^23.0.0" }`.

- [ ] **Step 3: Fehlschlagenden Test schreiben** — `tests/test_version.html`

```html
<script src="../version.js"></script>
<script src="_runner.js"></script>
<script>
suite('version.js');
test('APP_VERSION ist eine Semver-Zeichenkette', () => {
  assert(/^\d+\.\d+\.\d+$/.test(APP_VERSION), `APP_VERSION ungültig: ${APP_VERSION}`);
});
runAll();
</script>
```

- [ ] **Step 4: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm install && node run-tests.mjs`
Expected: FAIL — `version.js` fehlt.

- [ ] **Step 5: `version.js` schreiben**

Eine Zeile: `const APP_VERSION = '0.1.0';` plus Kommentar, dass hier bei jedem Release gebumpt wird.

- [ ] **Step 6: Test laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS, eine Suite.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: Projektgerüst, Version und Testrunner"
```

---

### Task 2: `storage.js` — Speicherschicht

**Files:**
- Create: `storage.js`
- Test: `tests/test_storage.html`

**Interfaces:**
- Consumes: nichts.
- Produces (alle unter `SW.storage`):
  - `DEFAULTS` — das Config-Objekt aus Spec §7.1, wortgleich.
  - `loadConfig(): Config` — fehlende Felder aus `DEFAULTS` ergänzt, defektes JSON ⇒ `DEFAULTS`.
  - `saveConfig(cfg): {ok: boolean, error?: string}`
  - `loadDay(dateStr): DayRecord|null` — `{target, mins, entries}`.
  - `saveDay(dateStr, rec): {ok, error?}`
  - `loadMonth(ym): object`, `listMonths(): string[]` (sortiert)
  - `loadRunning(): Running|null`, `saveRunning(r): {ok, error?}`, `clearRunning(): void`
  - `lastChange(): string|null`
  - `exportAll(): object` — `{appVersion, exportedAt, config, logs: {ym: monthObject}}`
  - `validateBackup(obj): {ok: boolean, errors: string[]}`
  - `importAll(obj): {ok, errors}` — schreibt nur bei `ok`.
  - `lastExportAt(): string|null`, `markExported(iso): void`
- Schlüssel: `sw_config`, `sw_log_YYYY-MM`, `sw_running`, `sw_last_change`, `sw_last_export`.
- Jeder erfolgreiche Schreibvorgang setzt `sw_last_change` auf die aktuelle ISO-Zeit.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_storage.html`

Jeder Test räumt `localStorage` mit Präfix `sw_` vorher auf.

```js
suite('storage');
test('loadConfig liefert ohne gespeicherte Config die Standardwerte', () => {
  assertEqual(SW.storage.loadConfig().dayTargets.mon, 240);
  assertEqual(SW.storage.loadConfig().categories.length, 4);
  assertEqual(SW.storage.loadConfig().categories[2].minPeriod, 'week');
  assertEqual(SW.storage.loadConfig().askAfterMinutes, 90);
});
test('loadConfig ergänzt fehlende Felder aus DEFAULTS', () => { /* nur {schemaVersion:1} gespeichert → hardStopMinutes === 600 */ });
test('loadConfig überlebt kaputtes JSON', () => { /* 'nicht-json' gespeichert → DEFAULTS */ });
test('saveDay/loadDay runden ein Tagesobjekt durch', () => { /* identische entries-Länge und target */ });
test('saveConfig setzt sw_last_change', () => { /* lastChange() != null, parsebar */ });
test('listMonths liefert nur eigene Schlüssel, sortiert', () => { /* lgc_log_2026-01 wird ignoriert */ });
test('saveDay meldet Fehler bei vollem Speicher statt stumm zu scheitern', () => {
  // localStorage.setItem wird temporär durch einen Werfer ersetzt (QuotaExceededError)
  const res = SW.storage.saveDay('2026-11-03', rec);
  assertEqual(res.ok, false);
  assert(/Speicher/.test(res.error), 'Fehlertext nennt den Speicher');
});
test('validateBackup lehnt fehlende und falsch typisierte Felder ab', () => {
  assertEqual(SW.storage.validateBackup({}).ok, false);
  assertEqual(SW.storage.validateBackup({config: {dayTargets: {mon: '240'}}}).ok, false);
  assertEqual(SW.storage.validateBackup(null).ok, false);
});
test('importAll schreibt bei ungültigem Backup nichts', () => {
  // gültige Config vorher speichern, kaputtes Backup importieren
  assertEqual(SW.storage.importAll({config: {categories: 'nein'}}).ok, false);
  assertEqual(SW.storage.loadConfig().categories.length, 4); // unverändert
});
test('exportAll und importAll sind zueinander invers', () => { /* export → clear → import → gleiche Config und gleicher Tag */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node run-tests.mjs`
Expected: FAIL — `SW is not defined`.

- [ ] **Step 3: `storage.js` implementieren**

Alle Schreibzugriffe laufen durch eine interne `writeKey(key, value)`, die `localStorage.setItem` in `try/catch` kapselt, bei Fehler `{ok:false, error:'Speicher voll oder gesperrt — nichts gespeichert.'}` zurückgibt und `sw_last_change` nur bei Erfolg setzt. `validateBackup` prüft Typen aller Felder aus §7.1 und §7.2 und sammelt alle Fehler statt beim ersten abzubrechen.

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS, alle Storage-Tests.

- [ ] **Step 5: Commit**

```bash
git add storage.js tests/test_storage.html && git commit -m "feat: Speicherschicht mit Validierung und Export/Import"
```

---

### Task 3: `model.js` — Zeitrechnung, Tagesgrenze, Überlappung

**Files:**
- Create: `model.js`
- Test: `tests/test_model_time.html`

**Interfaces:**
- Consumes: nichts.
- Produces (unter `SW.model`):
  - `entryMinutes(entry): number` — Minuten als Gleitkommazahl, **nie negativ** (bei `end < start` ⇒ `0`).
  - `splitAtMidnight(entry): Entry[]` — ein Eintrag über eine oder mehrere Tagesgrenzen wird in Teile je Kalendertag zerlegt; `id` des ersten Teils bleibt, Folgeteile bekommen `id + '-' + n`.
  - `dateKeyOf(iso): string` — `YYYY-MM-DD` in lokaler Zeit.
  - `overlapOf(entry, entries): Entry|null` — erster Eintrag, der sich zeitlich überschneidet; Berührung an den Rändern (`a.end === b.start`) ist **keine** Überschneidung; der Eintrag mit derselben `id` wird übersprungen.
  - `dayTotals(dayRec): {total: number, byCat: {[catId]: number}}` — Summen in Minuten, unbekannte Kategorien bleiben unter ihrer `cat`-Id erhalten.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_model_time.html`

```js
suite('model: Zeitrechnung');
test('entryMinutes rechnet normale Dauer', () => { /* 09:05:00 → 09:35:00 === 30 */ });
test('entryMinutes liefert 0 bei rückwärts laufender Uhr', () => {
  assertEqual(SW.model.entryMinutes({start:'2026-11-03T10:00:00+01:00', end:'2026-11-03T09:00:00+01:00'}), 0);
});
test('entryMinutes zählt über die Sommerzeit-Umstellung nur echte Zeit', () => {
  // 2027-03-28, 01:30+01:00 → 03:30+02:00 = 60 Minuten Wanduhr-Sprung, 60 echte Minuten
  assertEqual(SW.model.entryMinutes({start:'2027-03-28T01:30:00+01:00', end:'2027-03-28T03:30:00+02:00'}), 60);
});
test('splitAtMidnight teilt einen Eintrag über Mitternacht', () => {
  const parts = SW.model.splitAtMidnight({id:'e1', cat:'haushalt', start:'2026-11-03T23:40:00+01:00', end:'2026-11-04T00:20:00+01:00'});
  assertEqual(parts.length, 2);
  assertEqual(SW.model.dateKeyOf(parts[0].start), '2026-11-03');
  assertEqual(SW.model.entryMinutes(parts[0]), 20);
  assertEqual(SW.model.entryMinutes(parts[1]), 20);
});
test('splitAtMidnight lässt einen Eintrag innerhalb eines Tages unberührt', () => { /* parts.length === 1, gleiche id */ });
test('splitAtMidnight trifft die Grenze auch am 25-Stunden-Tag', () => {
  // 2026-10-24T23:30+02:00 → 2026-10-25T01:30+01:00: Teil 1 endet um Mitternacht lokaler Zeit
  const parts = SW.model.splitAtMidnight(/* … */);
  assertEqual(SW.model.dateKeyOf(parts[1].start), '2026-10-25');
});
test('overlapOf erkennt Überschneidung und ignoriert Berührung', () => { /* 10:00–10:45 vs 10:30–11:00 → Treffer; vs 10:45–11:00 → null */ });
test('overlapOf überspringt den Eintrag mit derselben id', () => { /* Bearbeiten eines bestehenden Eintrags → null */ });
test('dayTotals summiert je Kategorie und behält unbekannte Kategorien', () => { /* byCat['geloescht'] === 25 */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node run-tests.mjs`
Expected: FAIL — `SW.model is undefined`.

- [ ] **Step 3: `model.js` implementieren**

`splitAtMidnight` arbeitet über lokale Kalendertage: den nächsten Tagesbeginn als `Date` mit `setHours(0,0,0,0)` auf dem Folgetag bestimmen, nicht durch Addieren von 24 Stunden — sonst verschiebt die Zeitumstellung die Grenze.

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model.js tests/test_model_time.html && git commit -m "feat: Zeitrechnung, Tagesgrenzen-Teilung und Überlappungsprüfung"
```

---

### Task 4: `model.js` — Erfüllung und Serie

**Files:**
- Modify: `model.js`
- Test: `tests/test_model_rules.html`

**Interfaces:**
- Consumes: `SW.model.dayTotals`, `SW.model.dateKeyOf` aus Task 3; Config-Form aus Task 2.
- Produces (unter `SW.model`):
  - `rulesFor(dateStr, dayRec, config): {target: number, mins: {[catId]: [number, 'day'|'week']}}` — aus `dayRec.target`/`dayRec.mins`, falls vorhanden, sonst aus der aktuellen Config.
  - `snapshotRules(dateStr, config): {target, mins}` — was beim ersten Eintrag des Tages ins Protokoll kopiert wird; nur aktive Kategorien.
  - `dayStatus(dateStr, dayRec, config): {total, target, fulfilled, missing: [{cat, have, need}], free: boolean}` — `free` bei `target === 0`; `fulfilled` verlangt `total >= target` **und** jede Kategorie mit `minPeriod === 'day'` über ihrem Minimum. Wochen-Minima gehen nicht ein.
  - `weekRange(dateStr): {from: string, to: string}` — Montag bis Sonntag, auch über Jahreswechsel.
  - `weekStatus(dateStr, loadDay, config): {byCat: {[catId]: {have, need}}, fulfilled: boolean, total: number}` — `fulfilled` verlangt alle Tage der Woche erfüllt und alle `week`-Minima erreicht.
  - `streak(dateStr, loadDay, config): number` — zählt rückwärts ab dem Vortag von `dateStr`; Tage mit `target === 0` werden übersprungen, ohne zu zählen oder zu brechen; der heutige Tag bricht nie.
- `loadDay` wird als Funktion `(dateStr) => DayRecord|null` übergeben, damit die Tests ohne `localStorage` auskommen.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_model_rules.html`

```js
suite('model: Erfüllung');
test('dayStatus ist erfüllt bei 4 h und erreichten Tages-Minima', () => { /* fulfilled === true, missing.length === 0 */ });
test('dayStatus ist nicht erfüllt, wenn ein Tages-Minimum fehlt', () => { /* 4:30 gesamt, Bewerbungen 10 min → missing[0].cat === 'bewerbung', need === 30 */ });
test('dayStatus ignoriert Wochen-Minima', () => { /* Verein 0 min → fulfilled bleibt true */ });
test('dayStatus markiert Tage ohne Soll als frei', () => { /* Sonntag → free === true, fulfilled === false */ });
test('dayStatus stürzt bei unbekannter Kategorie nicht ab', () => { /* Eintrag auf 'geloescht' zählt in total, nicht in missing */ });
test('rulesFor bevorzugt den gespeicherten Abzug vor der aktuellen Config', () => {
  // dayRec.target === 240, Config inzwischen 300 → target bleibt 240
});
test('weekRange liefert Montag bis Sonntag über den Jahreswechsel', () => {
  assertEqual(SW.model.weekRange('2027-01-01').from, '2026-12-28');
});
test('weekStatus summiert Wochen-Minima über die ganze Woche', () => { /* 2×60 min Verein → byCat.verein.have === 120, fulfilled-Anteil erfüllt */ });
suite('model: Serie');
test('streak zählt aufeinanderfolgende erfüllte Tage', () => { /* Mo–Mi erfüllt, Abfrage Do → 3 */ });
test('streak überspringt freie Tage ohne zu brechen', () => { /* Fr erfüllt, Sa+So Soll 0, Mo erfüllt, Abfrage Di → 2 */ });
test('streak bricht an einem nicht erfüllten Werktag', () => { /* → 0 */ });
test('streak lässt sich vom unfertigen heutigen Tag nicht brechen', () => { /* heute 0 min, gestern erfüllt → 1 */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node run-tests.mjs`
Expected: FAIL — `SW.model.dayStatus is not a function`.

- [ ] **Step 3: Erfüllungs- und Serienlogik in `model.js` ergänzen**

`streak` fragt `loadDay` höchstens 400-mal rückwärts ab und bricht dann ab.

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model.js tests/test_model_rules.html && git commit -m "feat: Tages- und Wochenerfüllung samt Serienberechnung"
```

---

### Task 5: `clock.js` — Stempeln, Rückfrage, harte Obergrenze

**Files:**
- Create: `clock.js`
- Test: `tests/test_clock.html`

**Interfaces:**
- Consumes: `SW.storage` (Task 2), `SW.model.splitAtMidnight`, `entryMinutes`, `dateKeyOf`, `overlapOf`, `snapshotRules` (Tasks 3–4).
- Produces (unter `SW.clock`):
  - `start(catId, now): {ok, error?}` — stoppt eine laufende Kategorie und startet die neue in einem Zug; schreibt `sw_running` mit `{cat, start, lastSeen, reminded:false, asked:false}`.
  - `stop(now): {ok, error?, entries?}` — beendet den laufenden Eintrag, zerlegt ihn per `splitAtMidnight`, hängt die Teile an die jeweiligen Tage und legt bei einem neuen Tag den Abzug aus `snapshotRules` an.
  - `touch(now): void` — setzt `lastSeen`.
  - `checkOnVisible(now): {action: 'none'|'remind'|'ask'|'hardstop', minutes?: number, lastSeen?: string}` — **wertet zuerst mit dem alten `lastSeen` aus und setzt es erst danach**. `hardstop` sticht `ask`, `ask` sticht `remind`.
  - `resolveAsk(choice, now): {ok, error?}` — `choice` ist `'full'` (weiterlaufen lassen, `asked: true`), `'trim'` (bei `lastSeen` beenden, `src: 'trimmed'`) oder `'edit'` (bei `now` beenden und die Eintrags-Id zurückgeben).
  - `addManual(dateStr, catId, startIso, endIso): {ok, error?}` — lehnt Überschneidungen mit Klartext ab, `src: 'manual'`.
  - `editEntry(dateStr, id, patch): {ok, error?}`, `deleteEntry(dateStr, id): {ok, error?}`
- `now` wird überall als `Date` hereingereicht; `clock.js` ruft nie selbst `new Date()`.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_clock.html`

```js
suite('clock: Stempeln');
test('start schreibt den laufenden Eintrag', () => { /* loadRunning().cat === 'haushalt' */ });
test('start auf eine andere Kategorie stoppt die laufende und bucht sie', () => {
  // start haushalt 09:00, start bewerbung 09:30 → Tag hat 1 Eintrag haushalt mit 30 min, running.cat === 'bewerbung'
});
test('stop zerlegt einen Eintrag über Mitternacht auf zwei Tage', () => { /* loadDay('2026-11-03').entries.length === 1 && loadDay('2026-11-04').entries.length === 1 */ });
test('stop legt beim ersten Eintrag des Tages den Regel-Abzug an', () => { /* loadDay(d).target === 240 && mins.verein[1] === 'week' */ });
test('stop bucht nichts bei rückwärts gelaufener Uhr', () => { /* now < start → entries.length === 0, running geleert */ });
suite('clock: Rückfrage');
test('checkOnVisible meldet nach askAfterMinutes eine Rückfrage', () => { /* 95 min → action === 'ask', minutes ≈ 95 */ });
test('checkOnVisible wertet mit dem alten lastSeen aus und setzt es erst danach', () => {
  // lastSeen 95 min alt → action === 'ask' UND loadRunning().lastSeen === now
});
test('checkOnVisible fragt pro Eintrag nur einmal', () => { /* nach resolveAsk('full') → action === 'none' */ });
test('checkOnVisible meldet vor der Rückfrage-Zeit nur die Erinnerung', () => { /* 50 min → 'remind'; danach reminded === true, zweiter Aufruf → 'none' */ });
test('checkOnVisible meldet hardstop ab hardStopMinutes', () => { /* 11 h → 'hardstop' */ });
test("resolveAsk('trim') beendet bei lastSeen und markiert trimmed", () => { /* letzter Eintrag: src === 'trimmed', Dauer bis lastSeen */ });
test("resolveAsk('full') lässt die Uhr weiterlaufen", () => { /* loadRunning() != null, asked === true */ });
suite('clock: Nachträge');
test('addManual lehnt Überschneidungen mit Klartext ab', () => { /* ok === false, /Überschneidet sich/.test(error) */ });
test('addManual trägt einen Eintrag mit src manual nach', () => { /* entries.at(-1).src === 'manual' */ });
test('editEntry prüft die Überschneidung gegen die anderen Einträge, nicht gegen sich selbst', () => { /* ok === true */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node run-tests.mjs`
Expected: FAIL — `SW.clock is undefined`.

- [ ] **Step 3: `clock.js` implementieren**

Jeder Schreibpfad reicht das `{ok, error}` aus `SW.storage` unverändert nach außen; schlägt das Speichern fehl, wird `sw_running` **nicht** geleert.

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add clock.js tests/test_clock.html && git commit -m "feat: Stempelsteuerung mit Rückfrage und harter Obergrenze"
```

---

### Task 6: `taunts.js` — die Sprüche

**Files:**
- Create: `taunts.js`
- Test: `tests/test_taunts.html`

**Interfaces:**
- Consumes: `dayStatus`/`weekStatus`-Ergebnisse aus Task 4.
- Produces (unter `SW.taunts`):
  - `POOLS: {[state]: string[]}` mit genau diesen Schlüsseln: `tag_frisch`, `kaum_was`, `unterwegs`, `kurz_davor`, `soll_erfuellt`, `minimum_fehlt`, `woche_hinkt`, `spaet_und_wenig`, `freier_tag`, `serie_gebrochen` — je 8–12 Sprüche.
  - `stateFor({dayStatus, weekStatus, streakBroken, now}): string` — Vorrang von oben nach unten: `freier_tag`, `serie_gebrochen`, `soll_erfuellt`, `minimum_fehlt` (Tagessoll erreicht, Tages-Minimum offen), `spaet_und_wenig` (ab 18 Uhr und < 50 %), `woche_hinkt` (ab Donnerstag, ein `week`-Minimum unter der Hälfte), `kurz_davor` (≥ 75 %), `unterwegs` (≥ 25 %), `kaum_was` (> 0 %), `tag_frisch` (0 %).
  - `pick(state, config): string` — nimmt `config.taunts[state]`, falls vorhanden, sonst `POOLS[state]`; wählt zufällig, aber nie zweimal hintereinander denselben Spruch.
- Tonlage und Grenze: frech, duzend, kurz; Faulheit aufziehen ja — keine Sprüche über Arbeitslosigkeit, Geld oder Hartz IV als Vorwurf (Spec §6.6).

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_taunts.html`

```js
suite('taunts');
test('jeder Zustand hat 8 bis 12 Sprüche', () => { /* für alle 10 Schlüssel */ });
test('kein Spruch nennt Geld, Amt oder Hartz', () => {
  const verboten = /hartz|jobcenter|amt\b|arbeitslos|bürgergeld|stütze/i;
  // über alle Pools
});
test('stateFor erkennt den erfüllten Tag', () => { /* 'soll_erfuellt' */ });
test('stateFor meldet minimum_fehlt, wenn das Soll steht aber ein Tagesminimum fehlt', () => { /* 'minimum_fehlt' */ });
test('stateFor meldet freier_tag vor allem anderen', () => { /* free === true, 0 min → 'freier_tag' */ });
test('stateFor meldet spaet_und_wenig erst ab 18 Uhr', () => { /* 17:00 bei 40 % → 'unterwegs'; 18:30 → 'spaet_und_wenig' */ });
test('stateFor meldet woche_hinkt ab Donnerstag', () => { /* Verein 30 von 120 → 'woche_hinkt' */ });
test('pick bevorzugt eigene Sprüche aus der Config', () => { /* config.taunts.tag_frisch === ['Eigener'] → 'Eigener' */ });
test('pick wiederholt nicht unmittelbar denselben Spruch', () => { /* 20 Aufrufe, nie zwei gleiche hintereinander */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node run-tests.mjs`
Expected: FAIL — `SW.taunts is undefined`.

- [ ] **Step 3: `taunts.js` schreiben**

Die Sprüche selbst formuliert der Implementierer im Rahmen der Tonlage. Drei sind durch die Spec gesetzt und gehören in die passenden Pools: "Moin, faule Sau. 0 von 4 Stunden. Netflix kann warten." (`tag_frisch`), "1 von 4 Stunden. Die Couch gewinnt nach Punkten." (`kaum_was`), "4:15 geschafft. Heute warst du keine faule Sau." als Muster für `soll_erfuellt` (mit eingesetzter Zeit).

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add taunts.js tests/test_taunts.html && git commit -m "feat: Spruch-Pools und Zustandsauswahl"
```

---

### Task 7: App-Shell und Hauptschirm

**Files:**
- Create: `index.html`, `app.css`, `ui.js`, `ui-main.js`, `app.js`
- Test: `tests/test_ui_main.html`

**Interfaces:**
- Consumes: `SW.storage`, `SW.model`, `SW.clock`, `SW.taunts`.
- Produces:
  - `SW.ui.show(screenId)` — blendet die `<section class="screen">` um; Navigation unten mit vier Knöpfen (`#nav-main`, `#nav-log`, `#nav-history`, `#nav-settings`).
  - `SW.ui.fmt(minutes): string` — `1:12` bzw. `27 min`; `SW.ui.fmtClock(seconds): string` — `mm:ss`.
  - `SW.main.model(now, config, dayRec, loadDay): MainModel` — rein, ohne DOM:
    `{dateKey, taunt, total, target, fulfilled, free, bar: [{cat, color, minutes, share}], rows: [{cat, name, color, minutes, running, minLabel, minDone}], streak, weekTotal, exportHint}`
    `minLabel` ist `"27 / 30 min heute"`, `"1:30 / 2:00 diese Woche"` oder `"Minimum erfüllt ✓"`; `exportHint` ist gesetzt, wenn der letzte Export über 14 Tage her ist.
  - `SW.main.render(root, model)` — baut daraus das DOM.
  - `SW.ui.banner(text, kind)` — blendet einen Hinweisstreifen über dem Inhalt ein (`kind` `'remind' | 'error'`), mit Schließen-Knopf. Das ist der einzige Weg, auf dem die Erinnerung aus `SW.clock.checkOnVisible` sichtbar wird — **keine Notification-API**.
  - `SW.ui.ask(model, onChoice)` — die Rückfrage-Box aus Spec §6.4.1 mit den drei Knöpfen "Ja, voll buchen", "Nur bis HH:MM (letzte Berührung)", "Zeit selbst eintragen"; `onChoice` bekommt `'full' | 'trim' | 'edit'`.
- Die Darstellung folgt `docs/superpowers/specs/mockups/02-hauptschirm-final.html` (Variante C): Logo klein mit Spruch, großer Tageszähler mit gestapeltem Balken, darunter eine Zeile je Kategorie, Fuß mit Serie und Wochensumme. Bei `fulfilled` kippt der Kopfbereich auf `#38c172`, und das Logo bekommt die Klasse `sau-auf` (leichte Drehung, grüner Rand) — Spec §8.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_ui_main.html`

```js
suite('Hauptschirm-Modell');
test('model zeigt Tagessumme und Soll', () => { /* total === 72, target === 240 */ });
test('model stapelt den Balken in Kategorie-Reihenfolge mit Anteilen', () => { /* bar[0].share ≈ 0.1125, Summe der shares <= 1 */ });
test('model beschriftet ein Tagesminimum mit dem Tagesstand', () => { assertEqual(m.rows[0].minLabel, '27 / 30 min heute'); });
test('model beschriftet ein Wochenminimum mit dem Wochenstand', () => { assertEqual(m.rows[2].minLabel, '1:30 / 2:00 diese Woche'); });
test('model markiert erfüllte Minima', () => { /* minDone === true, minLabel === 'Minimum erfüllt ✓' */ });
test('model markiert die laufende Kategorie', () => { /* rows.filter(r => r.running).length === 1 */ });
test('model setzt den Export-Hinweis erst nach 14 Tagen', () => { /* 13 Tage → null, 15 Tage → Text */ });
suite('Hauptschirm-Darstellung');
test('render erzeugt eine Zeile je aktiver Kategorie', () => { /* root.querySelectorAll('.row').length === 4 */ });
test('render färbt den Kopf grün bei erfülltem Tag', () => { /* .hero.ok und .sau-auf vorhanden */ });
test('banner zeigt die Erinnerung als Streifen, nicht als Notification', () => {
  SW.ui.banner('Läuft die Uhr noch, oder du?', 'remind');
  assert(root.querySelector('.banner.remind'), 'Banner fehlt');
  assertEqual(typeof window.Notification === 'undefined' || notificationCalls, 0);
});
test('ask bietet genau drei Knöpfe und meldet die Wahl zurück', () => { /* Klick auf den zweiten → onChoice('trim') */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node run-tests.mjs`
Expected: FAIL — `SW.main is undefined`.

- [ ] **Step 3: `index.html`, `app.css`, `ui.js`, `ui-main.js` implementieren**

`index.html` lädt in dieser Reihenfolge: `version.js`, `storage.js`, `model.js`, `clock.js`, `taunts.js`, `ui.js`, `ui-main.js`, `ui-log.js`, `ui-history.js`, `ui-settings.js`, `app.js`. (Die drei letzten UI-Dateien kommen in Tasks 8–10 dazu; bis dahin existieren sie als leere Platzhalter.) `app.js` verdrahtet Start, `visibilitychange` → `SW.clock.checkOnVisible`, den Sekundentakt der laufenden Anzeige und die Rückfrage-Box.

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node run-tests.mjs`
Expected: PASS.

- [ ] **Step 5: In der App prüfen**

`npx http-server -p 8080` (oder ein beliebiger lokaler Server), `http://localhost:8080` öffnen, eine Kategorie starten und stoppen, Zähler und Balken beobachten.

- [ ] **Step 6: Commit**

```bash
git add index.html app.css ui.js ui-main.js app.js tests/test_ui_main.html && git commit -m "feat: App-Shell und Hauptschirm"
```

---

### Task 8: Tagesprotokoll mit Editor

**Files:**
- Create: `ui-log.js`
- Test: `tests/test_ui_log.html`

**Interfaces:**
- Consumes: `SW.clock.addManual`, `editEntry`, `deleteEntry`; `SW.model.dayTotals`.
- Produces:
  - `SW.log.model(dateKey, dayRec, config): {dateKey, rows: [{id, cat, name, color, from, to, minutes, src, srcLabel}], total}` — `srcLabel` ist `''` für `timer`, sonst `nachgetragen`, `gekürzt`, `automatisch gestoppt`. Eine `cat`, die in der Config fehlt, bekommt `name: 'Unbekannt'` und `color: '#6b7280'`.
  - `SW.log.render(root, model)`, `SW.log.openEditor(entryOrNull)` — Formular mit Kategorie, Von, Bis; Fehler aus `SW.clock` erscheinen im Klartext über dem Formular.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_ui_log.html`

```js
suite('Protokoll-Modell');
test('model listet Einträge mit Von/Bis und Dauer', () => { /* rows[0].from === '09:05', rows[0].minutes === 27 */ });
test('model beschriftet die Herkunft', () => { /* src manual → 'nachgetragen', trimmed → 'gekürzt' */ });
test('model zeigt gelöschte Kategorien als Unbekannt statt zu scheitern', () => {
  assertEqual(SW.log.model('2026-11-03', recMitGeloeschterKategorie, config).rows[0].name, 'Unbekannt');
});
suite('Protokoll-Darstellung');
test('render zeigt die Fehlermeldung einer abgelehnten Überschneidung an', () => { /* Text enthält 'Überschneidet sich' */ });
test('render zeigt bei leerem Tag einen Hinweis statt einer leeren Liste', () => { /* .empty vorhanden */ });
```

- [ ] **Step 2–4: Fehlschlag bestätigen, implementieren, grün bestätigen**

Run: `node run-tests.mjs`

- [ ] **Step 5: Commit**

```bash
git add ui-log.js tests/test_ui_log.html && git commit -m "feat: Tagesprotokoll mit Eintrags-Editor"
```

---

### Task 9: Historie

**Files:**
- Create: `ui-history.js`
- Test: `tests/test_ui_history.html`

**Interfaces:**
- Consumes: `SW.model.dayStatus`, `weekStatus`, `weekRange`, `streak`.
- Produces:
  - `SW.history.weekModel(dateStr, loadDay, config): {from, to, days: [{dateKey, weekday, total, target, fulfilled, free}], weekMins: [{cat, name, have, need, done}], total, fulfilled}`
  - `SW.history.monthModel(ym, loadDay, config): {ym, days: [...], fulfilledCount, total, byCat: [{cat, name, minutes, share}]}`
  - `SW.history.render(root, model, view)` mit `view` `'week' | 'month'`.

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_ui_history.html`

```js
suite('Historie');
test('weekModel liefert sieben Tage von Montag bis Sonntag', () => { /* days.length === 7, days[0].weekday === 'Mo' */ });
test('weekModel zeigt den Stand der Wochen-Minima', () => { /* weekMins.find(m => m.cat === 'verein').have === 90 */ });
test('monthModel zählt die erfüllten Tage', () => { /* fulfilledCount === 3 */ });
test('monthModel verteilt die Minuten auf Kategorien', () => { /* byCat Summe === total */ });
test('monthModel kommt mit einem leeren Monat zurecht', () => { /* total === 0, days.length === Tage des Monats */ });
```

- [ ] **Step 2–4: Fehlschlag bestätigen, implementieren, grün bestätigen**

Run: `node run-tests.mjs`

- [ ] **Step 5: Commit**

```bash
git add ui-history.js tests/test_ui_history.html && git commit -m "feat: Historie für Woche und Monat"
```

---

### Task 10: Einstellungen mit Export und Import

**Files:**
- Create: `ui-settings.js`
- Test: `tests/test_ui_settings.html`

**Interfaces:**
- Consumes: `SW.storage.loadConfig`, `saveConfig`, `exportAll`, `validateBackup`, `importAll`, `lastExportAt`, `markExported`.
- Produces:
  - `SW.settings.render(root, config)` — Kategorien (Name, Farbe, Minimum, Zeitraum `day|week`, aktiv, Reihenfolge), Tagessoll je Wochentag in Minuten, `askAfterMinutes`, `hardStopMinutes`, `reminderMinutes`, Speicher-Status, Export-Knopf mit "letzter Export: …", Import-Dateiauswahl, Config-Textfeld, App-Version.
  - `SW.settings.collect(root): Config` — liest das Formular zurück.
  - `SW.settings.applyJsonText(text): {ok, errors}` — prüft per `validateBackup` und speichert nur bei `ok`.
  - `SW.settings.downloadBackup(now)` — erzeugt `schaffwas-backup-YYYY-MM-DD.json` als Blob-Download und ruft `markExported`.
  - `SW.settings.requestPersist()` — ruft einmalig `navigator.storage.persist()`, falls vorhanden, und gibt den Status für die Anzeige zurück. Ohne API: `'unbekannt'`.
- Eine Kategorie wird nie gelöscht, solange sie Einträge hat — stattdessen `active: false` mit Hinweis "Historie bleibt erhalten".

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_ui_settings.html`

```js
suite('Einstellungen');
test('render und collect sind zueinander invers', () => { /* collect(render(config)) tief gleich config */ });
test('collect übernimmt geänderte Minimum-Zeiträume', () => { /* verein auf 'day' umgestellt → minPeriod === 'day' */ });
test('applyJsonText lehnt kaputtes JSON ab und ändert nichts', () => { /* ok === false, loadConfig() unverändert */ });
test('applyJsonText übernimmt gültiges JSON', () => { /* dayTargets.sat === 120 */ });
test('downloadBackup trägt das Datum im Dateinamen', () => { assertEqual(name, 'schaffwas-backup-2026-11-03.json'); });
test('Export-Hinweis zeigt den letzten Export in Tagen', () => { /* Text enthält 'vor 12 Tagen' */ });
test('requestPersist kommt ohne Storage-API zurecht', () => { /* 'unbekannt' */ });
```

- [ ] **Step 2–4: Fehlschlag bestätigen, implementieren, grün bestätigen**

Run: `node run-tests.mjs`

- [ ] **Step 5: Commit**

```bash
git add ui-settings.js tests/test_ui_settings.html && git commit -m "feat: Einstellungen mit JSON-Export und -Import"
```

---

### Task 11: PWA — Manifest, Service Worker, Icons

**Files:**
- Create: `manifest.json`, `sw.js`, `Logo-icon.png`, `Logo-icon-maskable.png`
- Modify: `index.html` (Manifest-Link, Service-Worker-Registrierung)
- Test: `tests/test_sw.html`

**Interfaces:**
- Consumes: `APP_VERSION` aus `version.js`.
- Produces: `CACHE_NAME = 'sw-shell-v' + APP_VERSION`, `CACHE_PREFIX = 'sw-shell-'`, `APP_SHELL` (alle App-Dateien, relativ mit `./`).
- Strategie wie LifeguardClock: App-Shell Cache-First, alles andere Network-First mit Cache-Fallback. Beim `activate` werden nur Caches mit `CACHE_PREFIX` gelöscht.
- `manifest.json`: `name`/`short_name` "Schaff was!", `display: "standalone"`, `orientation: "portrait"`, `background_color`/`theme_color` `#15181d`, `start_url: "./index.html"`, `scope: "./"`, Icons `Logo-icon.png` (`purpose: "any"`) und `Logo-icon-maskable.png` (`purpose: "maskable"`), beide 512×512.
- Bildmaterial im Repo: `Logo.png` (Sticker komplett, transparent), `Logo-Sau.png` (nur Schwein, transparent), `Logo-Schriftzug.png` (nur Schriftzug, **RGB ohne Alpha, weißer Grund — muss freigestellt werden**, Ergebnis ersetzt die Datei). Alle drei gehören in `APP_SHELL`.
- Icons entstehen aus `Logo-Sau.png`: enger Ausschnitt auf Kopf, Sonnenbrille und Oberkörper auf gelbem Grund `#f7d038`, ohne Schriftzug; die Maskable-Variante mit ca. 10 % Innenabstand (Spec §8).

- [ ] **Step 1: Fehlschlagende Tests schreiben** — `tests/test_sw.html`

Nach dem Muster von `C:\GitHub\LifeguardClock\tests\test_sw.html`: die Konstanten werden in der Testseite aus `version.js` nachgebildet und geprüft, ohne echten Service-Worker-Kontext.

```js
suite('Service Worker');
test('CACHE_NAME leitet sich aus APP_VERSION ab', () => { assertEqual(CACHE_NAME, 'sw-shell-v' + APP_VERSION); });
test('APP_SHELL enthält alle App-Dateien', () => { /* index.html, app.css, alle *.js, manifest.json, Logo.png, Icons */ });
test('APP_SHELL nutzt ausschließlich relative Pfade', () => { /* jeder Eintrag beginnt mit './' */ });
test('Aufräumen löscht nur eigene Caches', () => {
  assertEqual(shouldDelete('lgc-shell-v1.5.3'), false);
  assertEqual(shouldDelete('sw-shell-v0.0.9'), true);
  assertEqual(shouldDelete(CACHE_NAME), false);
});
test('manifest.json ist gültiges JSON mit relativer start_url', () => { /* per fetch geladen, start_url beginnt mit './' */ });
```

- [ ] **Step 2–4: Fehlschlag bestätigen, implementieren, grün bestätigen**

Run: `node run-tests.mjs`

- [ ] **Step 5: Installation prüfen**

Lokalen Server starten, in Chrome DevTools → Application: Manifest ohne Fehler, Service Worker aktiv, "Install" angeboten. Danach Netzwerk trennen und die Seite neu laden — die App muss starten.

- [ ] **Step 6: Commit**

```bash
git add manifest.json sw.js Logo-icon.png Logo-icon-maskable.png index.html tests/test_sw.html && git commit -m "feat: PWA-Manifest, Service Worker und Icons"
```

---

### Task 12: Dokumentation und Veröffentlichung

**Files:**
- Create: `README.md`, `CHANGELOG.md`
- Modify: `version.js` (auf `1.0.0`)

- [ ] **Step 1: `README.md` schreiben**

Was die App tut, die Regeln in drei Sätzen (Tagessoll, Tages- und Wochen-Minima, Rückfrage bei langen Uhren), Installation aufs Handy über die Pages-URL, Hinweis auf Export als einzige Sicherung und darauf, dass "Browserdaten löschen" alles entfernt, Tests mit `npm install && node run-tests.mjs`.

- [ ] **Step 2: `CHANGELOG.md` anlegen** — Eintrag `## 1.0.0` mit dem Funktionsumfang.

- [ ] **Step 3: Alle Tests ein letztes Mal laufen lassen**

Run: `node run-tests.mjs`
Expected: PASS, alle Suiten.

- [ ] **Step 4: Commit und Push**

```bash
gh auth switch --user MartinKammler
gh repo create MartinKammler/SchaffWas --public --source=. --remote=origin --push
gh auth switch --user DoomsdayGoddy
```

- [ ] **Step 5: GitHub Pages einschalten**

Settings → Pages → Branch `main`, Ordner `/`. Danach `https://martinkammler.github.io/SchaffWas/` auf dem Handy öffnen und installieren.
