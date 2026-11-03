// run-tests.mjs — Headless-Runner für die tests/test_*.html-Suiten.
// Liefert das Projekt über einen lokalen HTTP-Server aus (nicht file://):
// fetch, Service Worker und localStorage verhalten sich damit so wie in der
// echten App. Steuert einen installierten Chromium-Browser via puppeteer-core
// und liest das #summary-Ende-Signal jeder Seite aus.
// Exit 0 = alle Suiten grün, Exit 1 = mindestens ein Fehlschlag.
import { readdirSync, existsSync, createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = join(__dirname, 'tests');
const PAGE_TIMEOUT_MS = 30000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// Installierten Browser finden (kein Download). PUPPETEER_EXECUTABLE_PATH hat Vorrang.
function findBrowser() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find(p => existsSync(p)) || null;
}

function startServer() {
  const server = createServer((req, res) => {
    const pfad = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const ziel = normalize(join(__dirname, pfad === '/' ? 'index.html' : pfad));
    if (!ziel.startsWith(__dirname) || !existsSync(ziel) || !statSync(ziel).isFile()) {
      res.writeHead(404); res.end('nicht gefunden'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(ziel)] || 'application/octet-stream' });
    createReadStream(ziel).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function runFile(browser, file, port) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const url = `http://127.0.0.1:${port}/tests/${file}`;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
    await page.waitForSelector('#summary.all-pass, #summary.has-fail', { timeout: PAGE_TIMEOUT_MS });
    const res = await page.evaluate(() => {
      const sum = document.getElementById('summary');
      return {
        passed: sum.classList.contains('all-pass'),
        summary: sum.textContent.trim(),
        fails: [...document.querySelectorAll('.result.fail')].map(e => e.textContent.trim()),
      };
    });
    if (pageErrors.length) {
      return { file, ok: false, summary: 'Uncaught: ' + pageErrors.join('; '), fails: pageErrors };
    }
    return { file, ok: res.passed, summary: res.summary, fails: res.fails };
  } catch (e) {
    return { file, ok: false, summary: `Fehler/Timeout: ${e.message}`, fails: [] };
  } finally {
    await page.close();
  }
}

const exe = findBrowser();
if (!exe) {
  console.error('Kein Browser gefunden. Edge/Chrome installieren oder PUPPETEER_EXECUTABLE_PATH setzen.');
  process.exit(1);
}

const files = readdirSync(TESTS_DIR).filter(f => /^test_.*\.html$/.test(f)).sort();
if (files.length === 0) {
  console.error(`Keine test_*.html in ${TESTS_DIR} gefunden.`);
  process.exit(1);
}

const { server, port } = await startServer();
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
let allOk = true;
for (const f of files) {
  const r = await runFile(browser, f, port);
  allOk = allOk && r.ok;
  console.log(`${r.ok ? '✓' : '✗'} ${f} — ${r.summary}`);
  if (!r.ok) r.fails.forEach(t => console.log(`    • ${t}`));
}
await browser.close();
server.close();
console.log(allOk ? '\nAlle Suiten grün.' : '\nFehlschläge vorhanden.');
process.exit(allOk ? 0 : 1);
