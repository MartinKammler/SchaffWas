# Schaff was!

Eine Stempeluhr gegen den inneren Schweinehund. Kein Produktivitätssystem,
keine To-do-Liste — ein großer Knopf, der mitzählt, wie viel du heute wirklich
getan hast.

**App:** https://martinkammler.github.io/SchaffWas/

## Die Regeln

1. **Tagessoll.** Vier Stunden an Werktagen, pro Wochentag einstellbar. Das ist
   die Zahl, um die sich alles dreht.
2. **Mindestzeiten je Kategorie.** Jede Kategorie hat ein Minimum — entweder
   pro Tag (Haushalt, Bewerbungen: 30 min) oder pro Woche (Verein, Umbau:
   2 h). Damit rechnest du dir den Tag nicht mit der bequemsten Kategorie
   schön. Ein Tag ist grün, wenn das Tagessoll steht **und** alle Tages-Minima
   erfüllt sind.
3. **Lange Uhren werden hinterfragt.** Läuft eine Kategorie länger als 90
   Minuten, ohne dass du die App angefasst hast, fragt sie beim nächsten
   Öffnen nach: voll buchen, nur bis zur letzten Berührung, oder selbst
   eintragen. Nichts wird im Hintergrund stillschweigend abgeschnitten.

Vergessene oder falsche Zeiten korrigierst du im Protokoll; Überschneidungen
werden abgelehnt.

## Aufs Handy

Seite im Browser öffnen → Menü → *Zum Startbildschirm hinzufügen*. Danach
läuft sie offline wie eine normale App.

## Daten

Alles liegt **lokal im Browser** (`localStorage`, Präfix `sw_`). Kein Konto,
kein Server, keine Synchronisation.

> **Das heißt auch:** „Browserdaten löschen", eine neu installierte PWA oder
> ein Handy-Wechsel nehmen alles mit. Die einzige Sicherung ist der
> JSON-Export in den Einstellungen. Mach ihn gelegentlich — die App sagt dir,
> wann der letzte her ist.

Drei Dinge, die man wissen sollte:

- **Nur ein Fenster gleichzeitig.** Zwei offene Tabs derselben App können sich
  gegenseitig Schreibvorgänge überschreiben.
- **Der Speicher gehört der ganzen Herkunft, nicht dem Pfad.** Unter
  `martinkammler.github.io` liegen weitere Anwendungen. Das Schlüssel-Präfix
  `sw_` hält sie auseinander, ist aber kein Schutzwall. Wer echte Trennung
  will, braucht eine eigene (Sub-)Domain.
- **Der Export ist unverschlüsselt** und enthält dein vollständiges
  Zeitprotokoll.

Export und Import liegen unter *Einstellungen → Sicherung*. Dort lässt sich
die Konfiguration auch direkt als JSON bearbeiten.

## Entwicklung

Kein Build-Schritt, kein Framework. Reines HTML/CSS/JS, Dateien direkt im
Wurzelverzeichnis.

```bash
npm install          # nur puppeteer-core, für die Tests
node run-tests.mjs   # alle Suiten
```

### Beim Release

Die Versionsnummer steht an **zwei** Stellen, und das ist Absicht:

- `version.js` — für die App (Anzeige, Cache-Name)
- `sw.js` (`SW_SCRIPT_VERSION`) — damit sich das Hauptskript des Service
  Workers ändert. Nur daran erkennt ein Browser, dass es eine neue Version
  gibt; `version.js` kommt per `importScripts` aus dem HTTP-Cache und reicht
  nicht.

Beide müssen gleich sein — `tests/test_sw.html` bricht sonst ab.

Der Testrunner startet einen lokalen HTTP-Server und fährt die Suiten aus
`tests/` in einem installierten Edge oder Chrome headless durch. Lokal
ausprobieren: einen statischen Server im Wurzelverzeichnis starten
(`python -m http.server 8099`) und `http://127.0.0.1:8099/` öffnen —
`file://` funktioniert nicht, Service Worker brauchen HTTP(S).

### Aufbau

| Datei | Zweck |
|---|---|
| `storage.js` | einzige Speicherschicht (`localStorage`, Export/Import, Validierung) |
| `model.js` | Zeitrechnung, Tagesgrenzen, Erfüllung, Serie — ohne DOM |
| `clock.js` | Stempeln, Rückfrage, harte Obergrenze, Korrekturen |
| `taunts.js` | die Sprüche und ihre Zustandsauswahl |
| `ui*.js` | je ein Screen; jeder baut erst ein testbares Modell, dann DOM |
| `sw.js`, `sw-shell.js` | Service Worker und seine App-Shell-Liste |
| `version.js` | einzige Quelle der Version (`sw.js` leitet den Cache-Namen daraus ab) |

Design und Umsetzungsplan liegen unter `docs/superpowers/`.

## Lizenz

Privates Projekt.
