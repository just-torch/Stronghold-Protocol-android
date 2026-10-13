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
//       assets.mjs  art-container.mjs  the first-launch art download (from nodejs-template/)
//       asset-pack.json              where the art pack lives (from nodejs-template/; slim build)
//       lan/                         LAN room beacon: protocol.mjs + announce.mjs + host.mjs (from nodejs-template/)
//       server/  shared/  data/      copies from the game repository root
//       public/                      the whole browser client incl. assets (this is the big one)
//       node_modules/ws              the server's only runtime dependency
//
// Inside the app, `<files>/nodejs/public` is wiped and rewritten whenever the APK version changes, so the downloaded
// art lives in `<files>/nodejs/art` beside it (SP_ASSETS_DIR; nodejs-template/assets.mjs).
//
// Usage: node android/scripts/assemble-nodejs.mjs [--force] [--console=auto|0|1] [--slim]
//
// --console (default auto) is baked into the staged entry point's SP_CONSOLE (DESIGN §21.33, the debug console):
//   auto  the staged app keeps the server's own rule — a loopback client (the app's WebView) gets the console
//   1     every client of this app gets it (the test build; build-apk.ps1 -Variant devtest passes this)
//   0     nobody does
//
// --slim (alias --no-art; build-apk.ps1 -NoArt) stages an APK without public/assets — ~38 MB instead of ~560 MB —
// whose first launch downloads the art (pack-art.mjs builds the parts; assets.mjs fetches them), plus the community
// fallback the download falls back to when the parts cannot be reached (tools/fetch-assets.mjs and the Spine parser
// it needs, ~3 MB).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isPrunedAsset } from './art-set.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The Capacitor project root (this file lives in android/scripts/). */
const APP = path.resolve(SCRIPT_DIR, '..');
/** The game repository — android/scripts/../../ , i.e. the checkout that holds server/, public/ and data/. */
const REPO = path.resolve(APP, '..');
const WEB = path.join(APP, 'web');
const NODEJS = path.join(WEB, 'nodejs');
const TEMPLATE = path.join(SCRIPT_DIR, 'nodejs-template');

const FORCE = process.argv.includes('--force');
/**
 * `--slim` (build-apk.ps1 -NoArt): leave the game art (public/assets, ~660 MB) out of the APK. The app downloads it
 * on first launch into `<files>/nodejs/art` — the directory the Capacitor plugin never deletes — and the server serves
 * /assets/ from there (SP_ASSETS_DIR, server/http/static.js; nodejs-template/assets.mjs).
 */
const SLIM = process.argv.includes('--slim') || process.argv.includes('--no-art');
/** Debug console of the staged build: 'auto' (server default), '1' (every client), '0' (off). */
const consoleArg = (process.argv.find((a) => a.startsWith('--console=')) || '').slice('--console='.length);
const CONSOLE = ['auto', '0', '1'].includes(consoleArg) ? consoleArg : 'auto';
const CONSOLE_TOKEN = '__SP_CONSOLE__';
/** Baked into the staged entry point like the console token: '1' = a slim build (downloads the art on first launch). */
const SLIM_TOKEN = '__SP_SLIM__';
const log = (...a) => console.log(...a);

/** Directories copied verbatim from the repository into web/nodejs/. */
const MIRRORED = ['server', 'shared', 'data', 'public'];

// ---------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------
function fail(msg) { console.error(`\nERROR: ${msg}\n`); process.exit(1); }

/**
 * The installed packages one entry package needs, following `dependencies` and `peerDependencies` (the Spine parser
 * has the Pixi runtime as a peer, which is what actually pulls the tree in). Used by the slim build to stage exactly
 * the community fallback's dependencies instead of guessing a list.
 * @param {string} entry package name, e.g. '@pixi-spine/runtime-3.8'
 * @returns {string[]} package names, sorted
 */
function nodePackageClosure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'node_modules', ...name.split('/'), 'package.json'), 'utf8')); } catch { continue; }
    seen.add(name);
    for (const key of ['dependencies', 'peerDependencies']) {
      for (const dep of Object.keys(pkg[key] || {})) queue.push(dep);
    }
  }
  return [...seen].sort();
}

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
 * `exclude` are subdirectory paths of `src` left out of the copy (the slim build skips public/assets).
 * @param {string} src @param {string} dst @param {{ exclude?: string[] }} [opts]
 */
async function mirror(src, dst, { exclude = [] } = {}) {
  await fsp.mkdir(dst, { recursive: true });

  if (process.platform === 'win32') {
    // Exit codes 0-7 are success (they are a bit field of what was copied); 8+ means a real failure.
    const args = [src, dst, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:1', '/MT:16'];
    if (exclude.length) args.push('/XD', ...exclude);
    const res = spawnSync('robocopy', args, { stdio: 'inherit' });
    if (res.error) {
      log(`    robocopy unavailable (${res.error.message}); falling back to fs.cp`);
    } else if (res.status >= 8) {
      fail(`robocopy failed with exit code ${res.status} while mirroring ${src}`);
    } else {
      return;
    }
  }
  const skip = new Set(exclude.map((p) => path.resolve(p)));
  await fsp.cp(src, dst, { recursive: true, force: true, filter: (s) => !skip.has(path.resolve(s)) });
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
if (!SLIM && !fs.existsSync(path.join(REPO, 'public', 'assets'))) {
  fail('public/assets is missing — run `npm run setup` in the repository root first (the APK needs the game art), or build a slim APK with --slim (the art is downloaded on the phone).');
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
  if (!src.includes(SLIM_TOKEN)) fail(`${entry} does not carry ${SLIM_TOKEN} — the template and this script disagree`);
  await fsp.writeFile(entry, src.split(CONSOLE_TOKEN).join(CONSOLE).split(SLIM_TOKEN).join(SLIM ? '1' : '0'));
  log(`  index.js: SP_CONSOLE = ${CONSOLE === 'auto' ? "'auto' (the server's default: loopback clients only)" : CONSOLE}, slim = ${SLIM ? '1 (first launch downloads the art)' : '0 (the art is inside this APK)'}`);
}

// ---------------------------------------------------------------------------------------------------
// 2. the game itself
// ---------------------------------------------------------------------------------------------------
log(`\n=== Mirroring the game (this is the slow part on a cold run)${SLIM ? '; slim: public/assets is not copied at all' : ''} ===`);
for (const d of MIRRORED) {
  const src = path.join(REPO, d);
  const dst = path.join(NODEJS, d);
  const before = fs.existsSync(dst) ? (await dirSize(dst)).files : 0;
  log(`  ${d}/ → web/nodejs/${d}/   (${before} files already present)`);
  // The slim build has no art: leaving it out of the copy (instead of copying 660 MB and deleting it again) is both
  // faster and the only way robocopy /MIR can leave an existing staged tree correct.
  await mirror(src, dst, { exclude: SLIM && d === 'public' ? [path.join(src, 'assets')] : [] });
  const after = await dirSize(dst);
  log(`     now ${after.files} files, ${human(after.bytes)}`);
}

// The 11 official battlefield scenes ship a lightmap twice: the `.webp` the browser loads and the `.png` the extractor
// wrote beside it. `data/local-assets.json` names 35 `.webp`, 11 `.bin` and 11 `.json` under local/scene and no `.png`
// at all, so the sources are 26 MB of APK that no client ever requests (the repository keeps them: the extraction test
// checks a .png beside every .webp). Drop them from the staged copy only — the rule lives in art-set.mjs, which is also
// what the art pack (pack-art.mjs) uses, so the APK and the download can never disagree about what ships.
if (!SLIM) {
  const assetsDir = path.join(NODEJS, 'public', 'assets');
  let files = 0, bytes = 0;
  const walk = async (d, rel) => {
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { await walk(p, r); } else if (e.isFile() && isPrunedAsset(r)) {
        try { bytes += (await fsp.stat(p)).size; await fsp.rm(p); files++; } catch { /* ignore */ }
      }
    }
  };
  await walk(assetsDir, '');
  log(`  dropped ${files} art source image(s) the data never lists (${human(bytes)}) — see art-set.mjs`);
}

// Slim build: the art is downloaded on first launch instead. Drop the staged copy (the repository keeps it: the pack
// is built from there) and report what that does to the APK.
if (SLIM) {
  const assetsDir = path.join(NODEJS, 'public', 'assets');
  const before = await dirSize(assetsDir);
  await fsp.rm(assetsDir, { recursive: true, force: true });
  await fsp.mkdir(assetsDir, { recursive: true });
  log(`  slim: dropped public/assets from the staged tree (${before.files} files, ${human(before.bytes)})`);
  log('        the app downloads it on first launch (nodejs-template/assets.mjs; build the pack with pack-art.mjs)');
}

// The slim build also carries the community fallback: tools/fetch-assets.mjs (run in-process — the app has no second
// Node binary), the research tables its plan is built from, and the dependency closure of the Spine parser it uses to
// read model metadata. ~9 MB of JavaScript, ~3 MB in the APK. The full build needs none of it: its art is inside.
if (SLIM) {
  log('\n=== Staging the community asset fallback (slim only) ===');
  const RESEARCH = ['07-assets.json', '03-operators.json', '05-enemies.json', '05-maps.json'];
  await mirror(path.join(REPO, 'tools'), path.join(NODEJS, 'tools'));
  await fsp.mkdir(path.join(NODEJS, 'docs', 'research'), { recursive: true });
  for (const f of RESEARCH) {
    await fsp.copyFile(path.join(REPO, 'docs', 'research', f), path.join(NODEJS, 'docs', 'research', f));
  }
  log(`  tools/ + docs/research/ (${RESEARCH.length} tables the plan reads)`);
  const packages = nodePackageClosure('@pixi-spine/runtime-3.8');
  for (const name of packages) {
    await mirror(path.join(REPO, 'node_modules', ...name.split('/')), path.join(NODEJS, 'node_modules', ...name.split('/')));
  }
  const deps = await dirSize(path.join(NODEJS, 'node_modules'));
  log(`  node_modules: ${packages.length} packages, ${deps.files} files, ${human(deps.bytes)} (spine parser + Pixi closure)`);
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
log(`web/nodejs: ${total.files} files, ${human(total.bytes)}${SLIM ? '  (slim: no art — the app downloads it)' : ''}`);
const grand = await dirSize(WEB);
log(`web/       : ${grand.files} files, ${human(grand.bytes)}`);
log(`\nNext: pwsh -NoProfile -File android\\scripts\\build-apk.ps1${SLIM ? ' -NoArt -SkipAssemble' : ''}   (or: cd android && npx cap sync android)`);
log(`      the staged console mode is '${CONSOLE}' (--console=auto|0|1); build-apk.ps1 -Variant devtest uses 1`);
if (SLIM) log('      the art pack: node android\\scripts\\pack-art.mjs --base <release url>');
