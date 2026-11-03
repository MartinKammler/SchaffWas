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

  /* ── Teil 2: Erfüllung und Serie ────────────────────────────── */

  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function dateFromKey(dateStr) {
    const p = String(dateStr).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0, 0);
  }

  function shiftDays(dateStr, n) {
    const d = dateFromKey(dateStr);
    d.setDate(d.getDate() + n);
    return dateKeyOf(d);
  }

  function activeCategories(config) {
    const list = (config && Array.isArray(config.categories)) ? config.categories : [];
    return list.filter(c => c && c.active !== false);
  }

  function dayTargetFor(dateStr, config) {
    const key = WEEKDAY_KEYS[dateFromKey(dateStr).getDay()];
    const t = config && config.dayTargets ? config.dayTargets[key] : undefined;
    return typeof t === 'number' ? t : 0;
  }

  // Was beim ersten Eintrag eines Tages ins Protokoll kopiert wird. Ohne
  // diesen Abzug würde eine spätere Änderung an Soll oder Minima alte Tage
  // rückwirkend entwerten (Spec §7.2).
  function snapshotRules(dateStr, config) {
    const mins = {};
    activeCategories(config).forEach(c => { mins[c.id] = [c.minMinutes || 0, c.minPeriod || 'day']; });
    return { target: dayTargetFor(dateStr, config), mins: mins };
  }

  function rulesFor(dateStr, dayRec, config) {
    if (dayRec && typeof dayRec.target === 'number' && dayRec.mins) {
      return { target: dayRec.target, mins: dayRec.mins };
    }
    return snapshotRules(dateStr, config);
  }

  function dayStatus(dateStr, dayRec, config) {
    const rules = rulesFor(dateStr, dayRec, config);
    const totals = dayTotals(dayRec);
    const free = rules.target === 0;
    const missing = [];

    if (!free) {
      Object.keys(rules.mins).forEach(cat => {
        const regel = rules.mins[cat];
        const need = regel[0], periode = regel[1];
        if (periode !== 'day' || need <= 0) return;
        const have = totals.byCat[cat] || 0;
        if (have < need) missing.push({ cat: cat, have: have, need: need });
      });
    }

    return {
      total: totals.total,
      target: rules.target,
      byCat: totals.byCat,
      free: free,
      missing: missing,
      fulfilled: !free && totals.total >= rules.target && missing.length === 0
    };
  }

  // Montag bis Sonntag der Woche, in der dateStr liegt.
  function weekRange(dateStr) {
    const d = dateFromKey(dateStr);
    const dow = d.getDay(); // 0 = Sonntag
    const zurueck = (dow + 6) % 7;
    const from = shiftDays(dateStr, -zurueck);
    return { from: from, to: shiftDays(from, 6) };
  }

  function weekStatus(dateStr, loadDay, config) {
    const range = weekRange(dateStr);
    const rules = snapshotRules(dateStr, config);
    const byCat = {};
    Object.keys(rules.mins).forEach(cat => {
      if (rules.mins[cat][1] === 'week' && rules.mins[cat][0] > 0) {
        byCat[cat] = { have: 0, need: rules.mins[cat][0] };
      }
    });

    let total = 0;
    let alleTageErfuellt = true;
    let tag = range.from;
    for (let i = 0; i < 7; i++) {
      const rec = loadDay(tag);
      const totals = dayTotals(rec);
      total += totals.total;
      Object.keys(byCat).forEach(cat => { byCat[cat].have += (totals.byCat[cat] || 0); });

      const st = dayStatus(tag, rec, config);
      if (!st.free && !st.fulfilled) alleTageErfuellt = false;
      tag = shiftDays(tag, 1);
    }

    const minimaErfuellt = Object.keys(byCat).every(cat => byCat[cat].have >= byCat[cat].need);
    return { from: range.from, to: range.to, byCat: byCat, total: total, fulfilled: alleTageErfuellt && minimaErfuellt };
  }

  // Aufeinanderfolgende erfüllte Tage, rückwärts ab dem Vortag von dateStr.
  // Tage ohne Soll werden übersprungen: sie zählen nicht und brechen nicht.
  // Der heutige Tag wird nie bewertet — er ist noch nicht vorbei.
  function streak(dateStr, loadDay, config) {
    let zahl = 0;
    let tag = shiftDays(dateStr, -1);
    for (let i = 0; i < 400; i++) {
      const st = dayStatus(tag, loadDay(tag), config);
      if (st.free) { tag = shiftDays(tag, -1); continue; }
      if (!st.fulfilled) break;
      zahl++;
      tag = shiftDays(tag, -1);
    }
    return zahl;
  }

  return {
    toLocalIso: toLocalIso,
    dateKeyOf: dateKeyOf,
    nextMidnight: nextMidnight,
    shiftDays: shiftDays,
    entryMinutes: entryMinutes,
    splitAtMidnight: splitAtMidnight,
    overlapOf: overlapOf,
    dayTotals: dayTotals,
    dayTargetFor: dayTargetFor,
    snapshotRules: snapshotRules,
    rulesFor: rulesFor,
    dayStatus: dayStatus,
    weekRange: weekRange,
    weekStatus: weekStatus,
    streak: streak
  };
})();
