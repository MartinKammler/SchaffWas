# Changelog

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
