/* Mini Test-Runner für die test_*.html-Suiten.
   Vorbild: LifeguardClock, dort in jeder Testseite dupliziert — hier einmalig.
   run-tests.mjs wartet auf #summary.all-pass bzw. #summary.has-fail. */

const results = [];
const pending = [];
let currentSuite = '';

function suite(name) { currentSuite = name; }

function test(name, fn) {
  const suiteName = currentSuite;
  const p = (async () => {
    try { await fn(); results.push({ suite: suiteName, name, ok: true }); }
    catch (e) { results.push({ suite: suiteName, name, ok: false, err: e && e.message ? e.message : String(e) }); }
  })();
  pending.push(p);
  return p;
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Erwartet ${JSON.stringify(b)}, bekommen ${JSON.stringify(a)}`);
}

function assertDeepEqual(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg || `Erwartet ${sb}, bekommen ${sa}`);
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(msg || 'Erwartet wurde eine Ausnahme');
}

function assertClose(a, b, eps, msg) {
  if (Math.abs(a - b) > (eps === undefined ? 0.001 : eps)) {
    throw new Error(msg || `Erwartet ${b} (±${eps}), bekommen ${a}`);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const RUNNER_CSS = `
body { font-family: monospace; background: #0d0d12; color: #ccc; margin: 0; padding: 20px; }
h1 { color: #fff; font-size: 1.1rem; margin-bottom: 16px; }
.suite { margin-bottom: 20px; }
.suite-title { color: #7eb8f7; font-size: .9rem; margin-bottom: 6px; font-weight: bold; }
.pass { color: #4caf7d; }
.fail { color: #f76e6e; }
.result { font-size: .82rem; margin: 2px 0 2px 12px; }
#summary { margin-top: 24px; font-size: 1rem; font-weight: bold; padding: 10px; border-radius: 6px; }
.all-pass { background: #1a3a28; color: #4caf7d; }
.has-fail { background: #3a1a1a; color: #f76e6e; }
`;

/* Wartet auf alle registrierten Tests und rendert dann das Ergebnis. */
async function runAll() {
  await Promise.all(pending);
  const style = document.createElement('style');
  style.textContent = RUNNER_CSS;
  document.head.appendChild(style);
  const out = document.getElementById('output');
  const bySuite = new Map();
  for (const r of results) {
    if (!bySuite.has(r.suite)) bySuite.set(r.suite, []);
    bySuite.get(r.suite).push(r);
  }
  let html = '';
  for (const [name, rows] of bySuite) {
    html += `<div class="suite"><div class="suite-title">${escHtml(name)}</div>`;
    for (const r of rows) {
      html += r.ok
        ? `<div class="result pass">✓ ${escHtml(r.name)}</div>`
        : `<div class="result fail">✗ ${escHtml(r.name)} — ${escHtml(r.err)}</div>`;
    }
    html += '</div>';
  }
  if (out) out.innerHTML = html;

  const failed = results.filter(r => !r.ok).length;
  const sum = document.getElementById('summary');
  sum.textContent = failed === 0
    ? `${results.length} Tests, alle grün.`
    : `${results.length} Tests, ${failed} fehlgeschlagen.`;
  sum.className = failed === 0 ? 'all-pass' : 'has-fail';
}
