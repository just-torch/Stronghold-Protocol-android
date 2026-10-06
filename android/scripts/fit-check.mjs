// android/scripts/fit-check.mjs — render the real game screens at any viewport, measure the layout, save screenshots.
//
//   node android/scripts/fit-check.mjs [phase] [variant] [--phases A,B] [--viewport WxH ...] [--out <dir>]
//
// Examples
//   node android/scripts/fit-check.mjs PREP
//   node android/scripts/fit-check.mjs --phases PREP,COMBAT --viewport 800x360
//   node android/scripts/fit-check.mjs PREP collapsed
//
// Why this exists: "the UI proportions are wrong on my phone" and "the prep board should match the battle board"
// cannot be diagnosed from the CSS alone — the board's on-screen size is decided by the projection camera, which is
// a function of the viewport height, the HUD bands (computed in rem, fieldHost.js) and clearHud's re-fit, and the
// three interact. This drives the repo's own dev mock harness (public/dev/game-mock.html — the real screens with
// fabricated server data) in a headless Chromium, emulating a phone properly (mobile viewport, touch points so
// `pointer: coarse` matches, a landscape screen orientation), then reports the numbers that matter and writes a PNG
// per phase/viewport. With `--phases` it also prints the board-scale ratio between phases, which is the number that
// says whether the map jumps when the phase changes.
//
// It needs a Chromium-based browser and no extra npm packages: it speaks the DevTools Protocol directly over the
// WebSocket and fetch that Node 22+ has built in (puppeteer-core is a devDependency of the game repo and is commonly
// not installed). Set CHROME_PATH if the browser is somewhere unusual. For the prep-vs-battle board scale, prefer
// android/scripts/fit-math.mjs: it evaluates the camera functions directly and does not need a browser.
//
// Phases: PREP (default), COMBAT, UNITE, BOSS, RESULT … and variants shop, collapsed, drag, dead, pen, settings …
// — see public/dev/game-mock.html for the full lists. --viewport takes CSS px (a phone's browser viewport, not its
// physical resolution: a 1080×2400 phone at DPR 3 is 360×800 CSS px in portrait, 800×360 in landscape).
// Caveat: this harness switches the *screens*, but its COMBAT phase keeps the prep field camera, so do not use it to
// compare camera framing between phases.

import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(SCRIPT_DIR, '..');
const ROOT = path.resolve(APP, '..');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
const phaseArg = positional[0] || 'PREP';
const variant = positional[1] || '';
const OUT = path.resolve(ROOT, flag('out', 'android/.build/fit-shots'));
const PORT = Number(flag('port', 9223));
const PROFILE = path.join(OUT, '.profile');

/** --phases A,B runs each phase at every viewport and prints the board-scale ratio between them. */
const PHASES = (flag('phases', '') || phaseArg).split(',').map((s) => s.trim()).filter(Boolean);

/** The design target plus the phone viewports the repo's own UI tests use; --viewport replaces the list.
 *  deviceScaleFactor stays 1: it never affects CSS layout, and a DPR-3 backing store came back tiled from
 *  SwiftShader in headless mode. */
const DEFAULT_VIEWPORTS = [
  ['design-1920x1080', 1920, 1080],
  ['phone-915x412', 915, 412],
  ['phone-844x390', 844, 390],
  ['phone-900x415', 900, 415],
  ['phone-800x360', 800, 360],
  ['phone-756x366', 756, 366],
  ['phone-640x360', 640, 360],
];
const customViewports = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== '--viewport') continue;
  const m = /^(\d+)x(\d+)$/i.exec(argv[i + 1] || '');
  if (!m) { console.error(`--viewport wants WxH in CSS px, got ${argv[i + 1]}`); process.exit(2); }
  customViewports.push([`custom-${m[1]}x${m[2]}`, Number(m[1]), Number(m[2])]);
}
const VIEWPORTS = customViewports.length ? customViewports : DEFAULT_VIEWPORTS;

const BROWSER = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p));
if (!BROWSER) { console.error('no Chromium-based browser found (set CHROME_PATH)'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

/** Minimal DevTools Protocol client over the built-in WebSocket. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      const entry = msg.id && this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
      else entry.resolve(msg.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`)); }, 60000);
    });
  }
}

const openSocket = (url) => new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.addEventListener('open', () => resolve(ws));
  ws.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)));
});

const { startServer } = await import(pathToFileURL(path.join(ROOT, 'server', 'index.js')).href);
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-timer-throttling', '--mute-audio',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  'about:blank',
], { stdio: 'ignore' });

let version = null;
for (let i = 0; i < 60 && !version; i++) {
  await sleep(500);
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { /* not up yet */ }
}
if (!version) { browser.kill(); await srv.close(); console.error('browser never exposed DevTools'); process.exit(3); }

const cdp = new Cdp(await openSocket(version.webSocketDebuggerUrl));

const MEASURE = `(() => {
  const px = (v) => Math.round(v * 100) / 100;
  const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(); return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }; };
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 0;
  const W = innerWidth, H = innerHeight, ideal = Math.min(W / 19.2, H / 10.8);
  const out = { W, H, aspect: px(W / H), dpr: devicePixelRatio, rem: px(rem), idealRem: px(ideal),
    remFloored: rem > ideal + 0.01, designBoxH: px(rem * 10.8),
    coarse: matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches,
    htmlClasses: [...document.documentElement.classList].join(' '),
    field: rect('.gm__field'), canvas: rect('.gm__field canvas'), domFallback: !!document.querySelector('.ff'),
    gtop: rect('.gtop'), bonds: rect('.gm__bonds'), shopbar: rect('.shopbar'), corner: rect('.gm__corner') };
  try {
    // Mirror what the GAME measures (js/ui/fieldHost.js hudBands): the bond strip's bottom edge and the shop card
    // row's top edge, NOT the rem formula — the formula is only the fallback for when those elements are absent, and
    // reporting it after a CSS change would hide the effect being measured.
    const hud = document.querySelector('.gm__hud')?.getBoundingClientRect();
    const bonds = document.querySelector('.gm__bonds')?.getBoundingClientRect();
    const row = document.querySelector('.shopbar__row')?.getBoundingClientRect();
    const tab = document.querySelector('.shopbar-tab')?.getBoundingClientRect();
    const rem2 = rem || 100;
    out.bands = {
      source: (bonds && row) ? 'measured' : 'formula',
      top: px(Math.min(H * 0.4, bonds && bonds.bottom > 0 ? Math.max(bonds.bottom, hud?.top || 0) : (hud?.top || 0) + rem2 * 2.16)),
      bottom: px(Math.min(H * 0.4, row && row.top > 0 ? H - row.top : rem2 * 2.64 + 3)),
    };
    out.bands.folded = tab && tab.top > 0 ? px(Math.min(H * 0.4, H - tab.top)) : px(Math.min(H * 0.4, rem2 * 0.8 + 3));
    out.bands.sharePct = px((out.bands.top + out.bands.bottom) / H * 100);
    out.bands.free = px(H - out.bands.top - out.bands.bottom);
    // what sets the bottom band: the row's own height is the tallest of these (a card that kept a desktop height
    // silently decides the whole band, so it is worth naming)
    out.shopRow = row ? {
      h: px(row.height),
      kids: [...row.children].map((el) => ({
        c: String(el.className || el.tagName).split(' ')[0],
        w: px(el.getBoundingClientRect().width), h: px(el.getBoundingClientRect().height),
      })).sort((a, b) => b.h - a.h).slice(0, 4),
    } : null;
  } catch {}
  try {
    const v = globalThis.__SP_VIEW__;
    if (v && typeof v.tileScreen === 'function') {
      out.viewKeys = Object.keys(v);
      // tileScreen(row, col) → { x, y, s, poly }: s IS px per tile at that tile. Sample a FIXED board location that
      // exists in every phase (the prep rect is rows 7-12 / cols 0-10, and the normal view contains it), because the
      // tile size varies with depth and the different cameras look at different parts of the board.
      const mid = v.tileScreen(9, 5);
      const bench = v.tileScreen(7, 0);
      const last = v.tileScreen(12, 10);
      const kindOf = (x) => (x == null ? null : (typeof x === 'function' ? (() => { try { return x(); } catch { return null; } })() : x));
      out.tile = {
        viewKind: kindOf(v.kind) ?? kindOf(v.raw && v.raw.kind),
        pxPerTile: mid ? px(mid.s) : null,
        mid: mid ? { x: px(mid.x), y: px(mid.y), s: px(mid.s) } : null,
        bench: bench ? { x: px(bench.x), y: px(bench.y), s: px(bench.s) } : null,
        last: last ? { x: px(last.x), y: px(last.y), s: px(last.s) } : null,
        fieldH: bench && last ? px(bench.y - last.y) : null,
        fieldW: bench && last ? px(last.x - bench.x) : null,
      };
    }
  } catch (e) { out.probeError = String(e && e.message); }
  return out;
})()`;

const report = [];
for (const ph of PHASES) {
for (const [name, W, H] of VIEWPORTS) {
  // a fresh page per viewport: reusing one target across phases/viewports left stale state behind
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sid = attached.sessionId;
  const page = (m, p) => cdp.send(m, p, sid);
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: true,
    screenOrientation: { type: 'landscapePrimary', angle: 90 },
  });
  await page('Page.navigate', {
    url: `http://127.0.0.1:${srv.port}/dev/game-mock.html?phase=${ph}${variant ? `&variant=${variant}` : ''}&shot=1&render=engine`,
  });
  // wait for the screens to boot, then for the field view: the render engine mounts asynchronously (and slowly on a
  // cold asset cache), and measuring before it exists silently reports nothing — which is worse than failing.
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    await sleep(250);
    try {
      const r = await page('Runtime.evaluate', {
        expression: '!!(globalThis.__MOCK__ && globalThis.__SP_VIEW__ && document.querySelector(".gm__field canvas"))',
        returnByValue: true,
      });
      ready = !!r.result?.value;
    } catch { /* mid-navigation */ }
  }
  await sleep(ready ? 3000 : 2000);

  let measured = {};
  try {
    const r = await page('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
    measured = r.result?.value || {};
  } catch (e) { measured = { probeError: String(e.message) }; }

  const shot = path.join(OUT, `${ph}${variant ? `-${variant}` : ''}-${name}.png`);
  const cap = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(shot, Buffer.from(cap.data, 'base64'));
  report.push({ phase: ph, name, shot, ...measured });
  await cdp.send('Target.closeTarget', { targetId: target.targetId });
}
}

browser.kill();
await srv.close();

console.log(`fit-check: phase(s) ${PHASES.join(', ')}${variant ? ` variant ${variant}` : ''} → ${OUT}`);
for (const r of report) {
  console.log(`\n=== ${r.phase} · ${r.name}  (${r.W}×${r.H}, aspect ${r.aspect}) ===`);
  console.log(`  pointer        coarse=${r.coarse}   <html> ${r.htmlClasses}`);
  console.log(`  rem            ${r.rem}px   ideal ${r.idealRem}px` + (r.remFloored
    ? `   ← FLOORED: design box ${r.designBoxH}px tall in a ${r.H}px viewport (${Math.round(r.designBoxH - r.H)}px over)`
    : ''));
  console.log(`  .gm__field     ${r.field ? `${r.field.w}×${r.field.h}` : 'ABSENT'}   canvas ${r.canvas ? `${r.canvas.w}×${r.canvas.h}` : 'ABSENT'}   DOM fallback ${r.domFallback}`);
  console.log(`  HUD            gtop ${r.gtop ? r.gtop.h : '-'}px   bonds@y${r.bonds ? r.bonds.y : '-'}   shopbar ${r.shopbar ? `${r.shopbar.w}×${r.shopbar.h}@y${r.shopbar.y}` : '-'}   corner ${r.corner ? `${r.corner.w}×${r.corner.h}` : '-'}`);
  if (r.bands) console.log(`  prep bands     top ${r.bands.top} + bottom ${r.bands.bottom} = ${r.bands.sharePct}% of height → ${r.bands.free}px free`);
  if (r.shopRow) console.log(`  shop row       ${r.shopRow.h}px tall, tallest children: ${r.shopRow.kids.map((k) => `${k.c} ${k.w}×${k.h}`).join(', ')}`);
  if (r.tile) {
    console.log(`  board scale    ${r.tile.pxPerTile}px per tile at board (9,5)`
      + `   bench row7 s=${r.tile.bench ? r.tile.bench.s : '-'}   far (12,10) s=${r.tile.last ? r.tile.last.s : '-'}`);
    if (r.tile.fieldW) console.log(`  rect 7..12/0..10 on screen → ${r.tile.fieldW}×${r.tile.fieldH}px`);
  }
  if (r.probeError) console.log(`  probe error    ${r.probeError}`);
  console.log(`  screenshot     ${r.shot}`);
}
if (!report.some((r) => r.tile)) {
  console.log('\n(note: no tile scale reported — the field view was not up yet for those viewports)');
}

// The number that answers "does the map jump when the phase changes": the board scale of each phase, per viewport.
const scales = new Map();
for (const r of report) {
  if (!r.tile || !Number.isFinite(r.tile.pxPerTile)) continue;
  if (!scales.has(r.name)) scales.set(r.name, {});
  scales.get(r.name)[r.phase] = r.tile.pxPerTile;
}
if (PHASES.length > 1 && scales.size) {
  console.log('\n=== board scale by phase (px per tile at board 9,5) ===');
  console.log(`  ${'viewport'.padEnd(18)}${PHASES.map((p) => p.padStart(10)).join('')}   ratio vs ${PHASES[0]}`);
  for (const [name, byPhase] of scales) {
    const base = byPhase[PHASES[0]];
    const cells = PHASES.map((p) => (byPhase[p] == null ? '-' : String(byPhase[p])).padStart(10)).join('');
    const ratios = PHASES.slice(1).map((p) => (byPhase[p] == null || !base ? '-' : `${(byPhase[p] / base).toFixed(3)}×`)).join('  ');
    console.log(`  ${name.padEnd(18)}${cells}   ${ratios}`);
  }
  console.log('  (1.000× = the board is the same size in both phases; anything else is the jump to fix)');
}

await sleep(1500);
try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* leave it */ }
