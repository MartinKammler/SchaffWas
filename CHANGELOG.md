# Changelog

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
