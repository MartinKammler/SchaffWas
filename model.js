/* model.js — reine Rechenlogik ohne DOM und ohne Speicher.
   Teil 1: Zeitrechnung, Tagesgrenze, Überlappung, Tagessummen. */
window.SW = window.SW || {};

SW.model = (function () {

  function toDate(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Lokaler ISO-String mit Offset, z. B. 2026-11-03T09:05:11+01:00.
  function toLocalIso(d) {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const a = Math.abs(off);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
      + sign + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  }

  function dateKeyOf(iso) {
    const d = (iso instanceof Date) ? iso : toDate(iso);
    if (!d) return null;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Beginn des Kalendertages nach d, in lokaler Zeit. Bewusst über
  // setDate + setHours und nicht über "+24 Stunden": an den Umstellungstagen
  // hat der Tag 23 oder 25 Stunden.
  function nextMidnight(d) {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() + 1);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function entryMinutes(entry) {
    if (!entry) return 0;
    const s = toDate(entry.start), e = toDate(entry.end);
    if (!s || !e) return 0;
    const ms = e.getTime() - s.getTime();
    return ms > 0 ? ms / 60000 : 0;
  }

  // Zerlegt einen Eintrag an jeder lokalen Mitternacht, die er überschreitet.
  // Der erste Teil behält die id, Folgeteile bekommen id-2, id-3, …
  function splitAtMidnight(entry) {
    const s = toDate(entry.start), e = toDate(entry.end);
    if (!s || !e || e.getTime() <= s.getTime()) return [Object.assign({}, entry)];

    const parts = [];
    let cur = s;
    let n = 1;
    while (true) {
      const grenze = nextMidnight(cur);
      if (grenze.getTime() >= e.getTime()) {
        parts.push(Object.assign({}, entry, {
          id: n === 1 ? entry.id : entry.id + '-' + n,
          start: toLocalIso(cur),
          end: toLocalIso(e)
        }));
        break;
      }
      parts.push(Object.assign({}, entry, {
        id: n === 1 ? entry.id : entry.id + '-' + n,
        start: toLocalIso(cur),
        end: toLocalIso(grenze)
      }));
      cur = grenze;
      n++;
    }
    return parts;
  }

  // Erster Eintrag aus entries, der sich mit entry zeitlich überschneidet.
  // Berührung an den Rändern zählt nicht; der Eintrag mit derselben id wird
  // übersprungen (Bearbeiten eines bestehenden Eintrags).
  function overlapOf(entry, entries) {
    const s = toDate(entry.start), e = toDate(entry.end);
    if (!s || !e) return null;
    const liste = entries || [];
    for (let i = 0; i < liste.length; i++) {
      const o = liste[i];
      if (!o || o.id === entry.id) continue;
      const os = toDate(o.start), oe = toDate(o.end);
      if (!os || !oe) continue;
      if (s.getTime() < oe.getTime() && os.getTime() < e.getTime()) return o;
    }
    return null;
  }

  function dayTotals(dayRec) {
    const out = { total: 0, byCat: {} };
    const entries = (dayRec && Array.isArray(dayRec.entries)) ? dayRec.entries : [];
    entries.forEach(e => {
      const m = entryMinutes(e);
      if (!e.cat) return;
      out.byCat[e.cat] = (out.byCat[e.cat] || 0) + m;
      out.total += m;
    });
    return out;
  }

  return {
    toLocalIso: toLocalIso,
    dateKeyOf: dateKeyOf,
    nextMidnight: nextMidnight,
    entryMinutes: entryMinutes,
    splitAtMidnight: splitAtMidnight,
    overlapOf: overlapOf,
    dayTotals: dayTotals
  };
})();
