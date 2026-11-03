# Changelog

## 1.5.1 — 2026-11-03

**Updates kamen nicht an.** Wer die App installiert hatte, blieb auf 1.4.0
stehen — auch nach vollständigem Schließen.

Der Grund: Ein Browser erkennt eine neue Version ausschließlich daran, dass
sich `sw.js` Byte für Byte ändert. Unsere Versionsnummer lag aber nur in
`version.js`, das per `importScripts` geladen und dabei aus dem HTTP-Cache
bedient wird. `sw.js` selbst war seit 1.4.0 unverändert — 1.4.1 und 1.5.0
haben kein einziges Gerät erreicht.

Zwei Riegel dagegen:

- `sw.js` trägt die Versionsnummer jetzt selbst. Damit ändert sich das
  Hauptskript bei jeder Auslieferung. Ein Test schlägt fehl, wenn die beiden
  Stellen auseinanderlaufen — vergessen kann man es also nicht.
- Die Registrierung läuft mit `updateViaCache: 'none'`. Damit werden auch die
  importierten Skripte frisch geholt und nicht aus dem Cache bedient.

Nachgemessen statt vermutet: unter echten GitHub-Pages-Headern
(`max-age=600`) wurde eine Auslieferung, die nur `version.js` bumpt, nicht
erkannt; mit beiden Änderungen schon.

## 1.5.0 — 2026-11-03

- **Die Versionsnummer steht jetzt da, wo man sie sucht:** klein unter dem
  Sticker auf dem Startbild und in den Einstellungen direkt unter dem
  Schriftzug, zusammen mit dem Namen. Die alte Zeile ganz unten in den
  Einstellungen entfällt.

## 1.4.1 — 2026-11-03

Der angekündigte Kleinkram.

- **Wochen-Minima werden nicht mehr rückwirkend verschärft.** Wer sein
  Vereins-Minimum später von 2 h auf 3 h hebt, entwertet damit keine alten
  Wochen mehr. Ein eigener Wochen-Abzug war dafür nicht nötig — die
  Tagesdatensätze tragen die Regeln bereits; maßgeblich ist der erste Tag der
  Woche mit Einträgen.
- **Die Uhr schreibt beim Tippen nicht mehr mit.** Jede Berührung löste bisher
  zwei Schreibvorgänge aus, im JSON-Kasten also zwei pro Zeichen. Jetzt
  höchstens alle 30 Sekunden — bei einer Schwelle von 90 Minuten ändert das an
  der Rückfrage nichts.
- Nachgeprüft und **nicht** geändert: die Tagesgrenze in Zeitzonen, die um
  00:00 umstellen (Chile, Kuba). `setHours(0,0,0,0)` landet dort auf dem ersten
  existierenden Zeitpunkt des Tages — und genau der ist die richtige Grenze.
  Zwei Tests halten die Invariante jetzt fest, statt sie zu vermuten.

## 1.4.0 — 2026-11-03

Der Rest der Befunde aus dem externen technischen Review.

**Daten**

- **Backups werden jetzt inhaltlich geprüft, nicht nur auf Typen.** Abgelehnt
  werden: Einträge ohne positive Dauer, sich überschneidende Einträge eines
  Tages, doppelte Eintrags- und Kategorie-IDs, Einträge im falschen
  Tagesdatensatz, Tage im falschen Monat, unsinnige Zahlen (ein Tagessoll über
  24 h), sowie Backups aus einer neueren Programmversion. Dazu Obergrenzen für
  Datenmengen und Textlängen. Alle Fehler kommen auf einmal, mit Pfadangabe im
  Klartext.
- **Unbekannte Felder werden benannt, nicht verschluckt.** Ein Tippfehler im
  JSON-Kasten (`dayTarget` statt `dayTargets`) wird als Hinweis gemeldet, statt
  wirkungslos zu verpuffen — das Backup wird deswegen aber nicht abgelehnt.
- **Ein eingefügtes Teil-JSON ersetzt nicht mehr die ganze Konfiguration.**
  Vorher löschte `{"dayTargets": …}` sämtliche eigenen Kategorien.

**Zeiten**

- **Nachträge und Korrekturen dürfen über Mitternacht reichen.** Im Editor gibt
  es dafür den Schalter *Ende am Folgetag*; der Zeitraum wird an der
  Tagesgrenze geteilt wie eine gestempelte Zeit und auf beiden Tagen auf
  Überschneidung geprüft.

**Bedienung**

- **Tastatur und Screenreader.** Protokollzeilen sind echte Knöpfe statt
  klickbarer Flächen. Rückfrage, Editor und Import-Bestätigung sind richtige
  Dialoge: Fokus springt hinein, der Tabulator bleibt drin, beim Schließen
  kommt der Fokus zurück. Escape schließt den Editor — die Rückfrage bewusst
  nicht. Die Navigation meldet den aktiven Schirm, Hinweise und Fehler werden
  angesagt, und der Fokus ist überall sichtbar.

**Offline und Updates**

- **Eine halb geladene App-Shell gilt jetzt als Installationsfehler.** Vorher
  wurde der neue Service Worker trotzdem aktiv und löschte den letzten
  vollständigen Cache — die App startete danach offline nicht mehr.
- **Neue Versionen melden sich.** Statt still im Hintergrund zu warten,
  erscheint „Neue Version verfügbar" mit einem Knopf. Neu geladen wird erst auf
  Tipp — nie mitten im Tippen oder bei laufender Uhr.

**Kleinkram**

- `requestPersist` fragt einmal je Sitzung statt bei jedem Aufbau der
  Einstellungen.
- Die Monatsansicht liest jeden Tag nur noch einmal.
- Eine leere CSS-Regel entfernt.

## 1.3.0 — 2026-11-03

Behebt Befunde aus einem externen technischen Review.

- **Eine bestätigte Uhr lief unbegrenzt weiter.** Wer einmal „Ja, voll buchen"
  getippt hatte, wurde für diesen Eintrag **nie wieder** gefragt — und auch die
  harte Obergrenze griff nicht mehr. Mittags bestätigt und abends vergessen
  hieß: Die Uhr lief durch die Nacht und buchte Tag für Tag volle
  24 Stunden. Die Bestätigung startet jetzt einen neuen Beobachtungsabschnitt,
  statt die Überwachung abzuschalten.
- **Die Knöpfe der Rückfrage sagen jetzt, was sie tun.** „Ja, voll buchen"
  buchte nichts — es ließ die Uhr laufen. Neu: „Ja, ich arbeite noch —
  weiterlaufen lassen", „Bis 09:32 eintragen und stoppen", „Zeit selbst
  korrigieren".
- **Kategorie anlegen, entfernen und stilllegen** meldeten Erfolg, auch wenn
  das Speichern fehlgeschlagen war. Jetzt wird der Fehler angezeigt.
- **Ein gescheiterter Rollback beim Import** blieb stumm. Jetzt sagt die App
  deutlich, dass der vorherige Stand nicht vollständig wiederhergestellt werden
  konnte.
- Dokumentiert: mehrere offene Tabs können sich gegenseitig überschreiben, und
  `localStorage` trennt nach Herkunft, nicht nach Pfad — unter
  `martinkammler.github.io` liegen weitere Apps.

## 1.2.0 — 2026-11-03

- **Die laufende Uhr rollt jenseits einer Stunde auf Stunden um:** `2:05:30`
  statt `125:30`.
- **Die Historie lässt sich durchblättern** — eine Woche beziehungsweise einen
  Monat vor und zurück, mit einem „Heute“-Knopf zurück in die Gegenwart. Er
  erscheint nur, wenn du wirklich woanders bist.
- **Die Ansicht hängt nicht mehr über Mitternacht fest.** Bleibt die App über
  Nacht offen, zeigt die Historie beim nächsten Blick die aktuelle Woche —
  es sei denn, du hast selbst geblättert.
- **Tage, die noch kommen, sehen nicht mehr nach Fehlschlag aus.** Sie stehen
  gestrichelt und blass als „kommt noch“ da, statt als leere Balken in der
  Reihe der verpassten Tage.

## 1.1.0 — 2026-11-03

- **Startbild.** Beim Öffnen begrüßt der vollständige Sticker mit dem
  „Schaff was!“-Schriftzug. Er geht nach knapp anderthalb Sekunden von selbst
  weg — oder sofort, wenn man ihn antippt.
- Der Schriftzug steht jetzt auch über den Einstellungen. Damit sind alle drei
  Logo-Dateien im Einsatz: der Sticker auf dem Startbild, der Schriftzug auf
  Startbild und Einstellungen, das Schwein allein im Kopf des Hauptschirms und
  als App-Icon.

## 1.0.1 — 2026-11-03

Behebt Befunde aus dem Abschluss-Review, wichtigster zuerst:

- **„Nur bis letzte Berührung“ buchte auf dem Handy die volle Zeit.** Der
  globale `touchstart`-Lauscher setzte `lastSeen` auf jetzt, bevor der Knopf
  seine Antwort auslöste. Der Trimm-Zeitpunkt wandert jetzt mit der Rückfrage
  mit.
- Die laufende Uhr zählt in Tagessumme, Balken, Mindestzeiten und Erfüllung;
  der Hauptschirm zieht minütlich nach, ohne dass der Spruch springt.
- Buchen über die Tagesgrenze ist wiederholbar: nach einem Schreibfehler kann
  ein zweiter Stopp denselben Abschnitt nicht doppelt anlegen.
- Backup-Import ist atomar, ersetzt wirklich den Bestand und fragt vorher nach.
- Die harte Obergrenze greift nur noch bei wirklich unbeachteter Uhr.
- Schreibfehler (voller Speicher) werden angezeigt statt verschluckt.
- Eine stillgelegte oder gelöschte laufende Kategorie behält ihren Stopp-Knopf.
- Die Überlappungsprüfung kennt die laufende Uhr.
- `saveConfig` validiert: ein Tippfehler in den Einstellungen kann die Uhr
  nicht mehr lahmlegen.
- Fehlende Mindestzeiten werden beim Namen genannt.

## 1.0.0 — 2026-11-03

Erste Fassung.

- **Stempeluhr** mit immer nur einer laufenden Kategorie; Start auf einer
  anderen stoppt die laufende. Die Zeit wird über Zeitstempel gerechnet, nicht
  über einen laufenden Zähler — Bildschirmsperre, App-Schließen und
  Handy-Tiefschlaf verfälschen nichts.
- **Tagessoll je Wochentag** (Standard Mo–Fr 4 h, Sa/So frei). Tage ohne Soll
  brechen die Serie nicht.
- **Mindestzeiten je Kategorie**, wahlweise pro Tag oder pro Woche. Standard:
  Haushalt und Bewerbungen 30 min/Tag, Verein und Umbau 2 h/Woche.
- **Rückfrage statt stillem Abschneiden:** Lief eine Kategorie über 90 Minuten
  unbeachtet, fragt die App beim nächsten Öffnen nach (voll buchen / nur bis
  zur letzten Berührung / selbst eintragen). Harte Obergrenze bei 10 Stunden.
- **Tagesprotokoll** mit Bearbeiten, Löschen und Nachtragen;
  Überschneidungen werden mit Klartext abgelehnt.
- **Historie** für Woche und Monat: erfüllte Tage, Wochen-Minima,
  Kategorieverteilung, Serie.
- **Einstellungen** für Kategorien, Tagesziele und Uhr-Verhalten, dazu
  JSON-Export und -Import sowie ein direkt bearbeitbares Config-JSON.
- **Frecher Ton:** zehn Spruch-Pools nach Tageslage, über das Config-JSON
  durch eigene ersetzbar.
- **PWA:** installierbar, läuft offline, dunkles Design, Logo der faulen Sau.
- Einträge über Mitternacht werden an der Tagesgrenze geteilt — auch an den
  Umstellungstagen von Sommer- und Winterzeit.
- Tagessoll und Minima werden pro Tag ins Protokoll kopiert: spätere
  Änderungen an den Einstellungen entwerten keine alten Tage.
