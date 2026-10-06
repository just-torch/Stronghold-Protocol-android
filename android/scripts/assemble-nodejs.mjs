// android/scripts/assemble-nodejs.mjs — build android/web/nodejs, the self-contained game server that the
// Android app unpacks and runs on the phone.
//
// Layout produced (mirrors the game repository so server/index.js needs no changes at all — it derives its own
// ROOT from import.meta.url and then finds public/, data/ and shared/ as siblings):
//
//   android/web/
//     index.html                     launcher page (authored)
//     launcher.js                    launcher logic (authored)
//     vendor/capacitor.js            @capacitor/core browser bundle (IIFE → window.capacitorExports)
//     vendor/capacitor-nodejs.js     @jadejr/capacitor-nodejs browser bundle (IIFE → window.capacitorCapacitorNodeJS)
//     nodejs/
//       index.js  package.json       entry point + manifest (from nodejs-template/)
//       lan/                         LAN room beacon: protocol.mjs + announce.mjs + host.mjs (from nodejs-template/)
//       server/  shared/  data/      copies from the game repository root
//       public/                      the whole browser client incl. assets (this is the big one)
//       node_modules/ws              the server's only runtime dependency
//
// Usage: node android/scripts/assemble-nodejs.mjs [--force] [--console=auto|0|1]
//
// --console (default auto) is baked into the staged entry point's SP_CONSOLE (DESIGN §21.33, the debug console):
//   auto  the staged app keeps the server's own rule — a loopback client (the app's WebView) gets the console
//   1     every client of this app gets it (the test build; build-apk.ps1 -Variant devtest passes this)
//   0     nobody does

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The Capacitor project root (this file lives in android/scripts/). */
const APP = path.resolve(SCRIPT_DIR, '..');
/** The game repository — android/scripts/../../ , i.e. the checkout that holds server/, public/ and data/. */
const REPO = path.resolve(APP, '..');
const WEB = path.join(APP, 'web');
const NODEJS = path.join(WEB, 'nodejs');
const TEMPLATE = path.join(SCRIPT_DIR, 'nodejs-template');

const FORCE = process.argv.includes('--force');
/** Debug console of the staged build: 'auto' (server default), '1' (every client), '0' (off). */
const consoleArg = (process.argv.find((a) => a.startsWith('--console=')) || '').slice('--console='.length);
const CONSOLE = ['auto', '0', '1'].includes(consoleArg) ? consoleArg : 'auto';
const CONSOLE_TOKEN = '__SP_CONSOLE__';
const log = (...a) => console.log(...a);

/** Directories copied verbatim from the repository into web/nodejs/. */
const MIRRORED = ['server', 'shared', 'data', 'public'];

// ---------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------
function fail(msg) { console.error(`\nERROR: ${msg}\n`); process.exit(1); }

async function dirSize(dir) {
  let bytes = 0;
  let files = 0;
  const walk = async (d) => {
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) { files++; try { bytes += (await fsp.stat(p)).size; } catch { /* ignore */ } }
    }
  };
  await walk(dir);
  return { bytes, files };
}

const human = (b) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(2)} GiB` : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MiB` : `${(b / 1024).toFixed(0)} KiB`);

/**
 * Mirror `src` into `dst`, deleting stale entries in `dst`.
 * Uses robocopy on Windows (much faster for the ~5500 small asset files) and fs.cp elsewhere.
 */
async function mirror(src, dst) {
  await fsp.mkdir(dst, { recursive: true });

  if (process.platform === 'win32') {
    // Exit codes 0-7 are success (they are a bit field of what was copied); 8+ means a real failure.
    const args = [src, dst, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:1', '/MT:16'];
    const res = spawnSync('robocopy', args, { stdio: 'inherit' });
    if (res.error) {
      log(`    robocopy unavailable (${res.error.message}); falling back to fs.cp`);
    } else if (res.status >= 8) {
      fail(`robocopy failed with exit code ${res.status} while mirroring ${src}`);
    } else {
      return;
    }
  }
  await fsp.cp(src, dst, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------------
// 0. sanity checks
// ---------------------------------------------------------------------------------------------------
log('=== Checking inputs ===');
for (const d of MIRRORED) {
  const p = path.join(REPO, d);
  if (!fs.existsSync(p)) fail(`missing source directory: ${p}`);
  log(`  ok  ${d}/`);
}
if (!fs.existsSync(path.join(REPO, 'public', 'assets'))) {
  fail('public/assets is missing — run `npm run setup` in the repository root first (the APK needs the game art).');
}
if (!fs.existsSync(path.join(APP, 'node_modules'))) {
  fail(`android/node_modules is missing — run: cd android && npm install`);
}

const wsSrc = path.join(REPO, 'node_modules', 'ws');
if (!fs.existsSync(wsSrc)) fail(`missing ${wsSrc} — run \`npm install\` in the repository root first.`);
const capCoreJs = path.join(APP, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js');
const capNodeJs = path.join(APP, 'node_modules', '@jadejr', 'capacitor-nodejs', 'dist', 'plugin.js');
for (const f of [capCoreJs, capNodeJs]) {
  if (!fs.existsSync(f)) fail(`missing ${f} — run: cd android && npm install`);
}

// ---------------------------------------------------------------------------------------------------
// 1. template files
// ---------------------------------------------------------------------------------------------------
log('\n=== Writing the Node.js entry point ===');
await fsp.mkdir(NODEJS, { recursive: true });
/** Copy nodejs-template/ (index.js, package.json, lan/**) over web/nodejs/, keeping the directory shape. */
async function copyTemplate(srcDir, dstDir, prefix = '') {
  await fsp.mkdir(dstDir, { recursive: true });
  for (const entry of await fsp.readdir(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyTemplate(src, dst, `${prefix}${entry.name}/`);
    } else if (entry.isFile()) {
      await fsp.copyFile(src, dst);
      log(`  ${prefix}${entry.name}`);
    }
  }
}
await copyTemplate(TEMPLATE, NODEJS);

// The staged entry point carries this build's debug-console choice (DESIGN §21.33): the template ships the token, the
// staged copy gets the value — so one tree can be built as the release app and another as the test app.
{
  const entry = path.join(NODEJS, 'index.js');
  const src = await fsp.readFile(entry, 'utf8');
  if (!src.includes(CONSOLE_TOKEN)) fail(`${entry} does not carry ${CONSOLE_TOKEN} — the template and this script disagree`);
  await fsp.writeFile(entry, src.split(CONSOLE_TOKEN).join(CONSOLE));
  log(`  index.js: SP_CONSOLE = ${CONSOLE === 'auto' ? "'auto' (the server's default: loopback clients only)" : CONSOLE}`);
}

// ---------------------------------------------------------------------------------------------------
// 2. the game itself
// ---------------------------------------------------------------------------------------------------
log('\n=== Mirroring the game (this is the slow part on a cold run) ===');
for (const d of MIRRORED) {
  const src = path.join(REPO, d);
  const dst = path.join(NODEJS, d);
  const before = fs.existsSync(dst) ? (await dirSize(dst)).files : 0;
  log(`  ${d}/ → web/nodejs/${d}/   (${before} files already present)`);
  await mirror(src, dst);
  const after = await dirSize(dst);
  log(`     now ${after.files} files, ${human(after.bytes)}`);
}

// ---------------------------------------------------------------------------------------------------
// 3. the server's only runtime dependency
// ---------------------------------------------------------------------------------------------------
log('\n=== Bundling node_modules/ws ===');
const wsDst = path.join(NODEJS, 'node_modules', 'ws');
await mirror(wsSrc, wsDst);
const wsInfo = await dirSize(wsDst);
log(`     ws: ${wsInfo.files} files, ${human(wsInfo.bytes)}`);

// ---------------------------------------------------------------------------------------------------
// 4. browser bundles for the launcher page
// ---------------------------------------------------------------------------------------------------
log('\n=== Copying the Capacitor browser bundles ===');
const vendor = path.join(WEB, 'vendor');
await fsp.mkdir(vendor, { recursive: true });
await fsp.copyFile(capCoreJs, path.join(vendor, 'capacitor.js'));
await fsp.copyFile(capNodeJs, path.join(vendor, 'capacitor-nodejs.js'));
log('  vendor/capacitor.js');
log('  vendor/capacitor-nodejs.js');

// ---------------------------------------------------------------------------------------------------
// 5. report
// ---------------------------------------------------------------------------------------------------
log('\n=== Done ===');
const total = await dirSize(NODEJS);
log(`web/nodejs: ${total.files} files, ${human(total.bytes)}`);
const grand = await dirSize(WEB);
log(`web/       : ${grand.files} files, ${human(grand.bytes)}`);
log('\nNext: pwsh -NoProfile -File android\\scripts\\build-apk.ps1   (or: cd android && npx cap sync android)');
log(`      the staged console mode is '${CONSOLE}' (--console=auto|0|1); build-apk.ps1 -Variant devtest uses 1`);
