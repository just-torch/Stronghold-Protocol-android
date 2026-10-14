// android/scripts/pack-art.mjs — maintainer-side packer for the downloadable game art (frozen format).
//
// The slim APK ships no art; the phone downloads it on first launch. This script turns `public/assets` into the
// files the downloader consumes (.scratch/slim-art-design.md §2, §3):
//
//   android/dist/art/assets-pack-<app>-000.part   ~64 MiB of raw payload each, one SPART1 container per part
//   android/dist/art/assets-index-<app>.json      every shipped path → [size, sha256]
//   android/dist/art/assets-pack-<app>.json       the authoritative part list (name, bytes, sha256, files, rawBytes)
//   android/scripts/nodejs-template/asset-pack.json   (only with --base) the base URLs baked into the APK
//
// Usage (from the repository root):
//   node android/scripts/pack-art.mjs --dry-run
//   node android/scripts/pack-art.mjs --base https://example.invalid/art/
//
// Run it once per release, upload the parts + the two JSON files, then build the slim APK with the asset-pack.json it
// wrote. Nothing here is on the app's runtime path.

import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { ASSETS_REL, listArtFiles } from './art-set.mjs';
import { CONTAINER, DEFAULT_CODEC, writePart } from './nodejs-template/art-container.mjs';
import { artIdFrom } from './nodejs-template/art-id.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The Capacitor project root (this file lives in android/scripts/). */
const APP = path.resolve(SCRIPT_DIR, '..');
/** The game repository — android/scripts/../.. — the checkout that holds public/assets. */
const REPO = path.resolve(APP, '..');
const TEMPLATE = path.join(SCRIPT_DIR, 'nodejs-template');

export const DEFAULT_OUT = path.join('android', 'dist', 'art');
export const DEFAULT_PART_BYTES = 67108864; // 64 MiB of raw payload
export const PACK_FORMAT = 1;

const HELP = `pack-art.mjs — pack public/assets into downloadable art parts (SPART1 containers).

Usage: node android/scripts/pack-art.mjs [options]

Options:
  --out <dir>            output directory (default ${DEFAULT_OUT})
  --part-bytes <n>       raw payload per part (default ${DEFAULT_PART_BYTES} = 64 MiB); a single bigger file gets a part of its own
  --app <version>        app version used in the file names and the manifests (default: version in android/package.json)
  --base <url>[,…]       download base URL(s); repeatable, joined in order (also written to nodejs-template/asset-pack.json)
  --pointer <url>[,…]    small stable URLs the app reads first; their content overrides --base at run time (repeatable)
  --pointer-out <file>   also write that pointer payload to <file> (e.g. pack.json at the repository root)
  --manifest-name <n>    manifest file name (default assets-pack-<app>.json)
  --dry-run              plan and print the numbers only, write nothing
  --help                 this text
`;

// ---------------------------------------------------------------------------------------------------
// planning
// ---------------------------------------------------------------------------------------------------
const partName = (app, i) => `assets-pack-${app}-${String(i).padStart(3, '0')}.part`;
const indexName = (app) => `assets-index-${app}.json`;
const defaultManifestName = (app) => `assets-pack-${app}.json`;

/**
 * The identity of the *art*, not of the app: `art-id.mjs` over `data/assets.json` and `data/local-assets.json`. An app
 * accepts a pack whose `artId` equals the id of the two manifests it ships, so a release that only changed code keeps
 * using the pack already on the phone — no 502 MB re-upload, no re-download. Empty when neither manifest is readable:
 * the pack then carries no `artId` and the app falls back to comparing its version with `app` (the 0.2.5 behaviour).
 * @param {string} [root] the game repository root
 */
export function readArtId(root = REPO) {
  const read = (rel) => {
    try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; }
  };
  return artIdFrom({ assets: read(path.join('data', 'assets.json')), local: read(path.join('data', 'local-assets.json')) });
}

/**
 * The small "where do the parts live now" file the app reads before anything else (`asset-pack.json` `pointers`). It
 * is what makes moving the parts to another host a 200-byte commit instead of a new APK.
 */
export function pointerPayload({ app, manifestName, bases }) {
  return { format: PACK_FORMAT, app, manifest: manifestName, bases };
}

/**
 * Fill parts up to `partBytes` of raw payload, in the given order. A file larger than the limit is the only member of
 * its own part (and that part is bigger than the limit — that is the documented behaviour).
 *
 * @param {{ rel: string, abs: string, size: number }[]} files
 * @param {number} partBytes
 * @returns {{ files: { rel: string, abs: string, size: number }[], rawBytes: number }[]}
 */
export function planParts(files, partBytes) {
  const limit = Math.max(1, Math.floor(partBytes));
  const parts = [];
  let current = null;
  for (const file of files) {
    if (current && current.rawBytes + file.size > limit) current = null;
    if (!current) {
      current = { files: [], rawBytes: 0 };
      parts.push(current);
    }
    current.files.push(file);
    current.rawBytes += file.size;
  }
  return parts;
}

/** sha256 of a file, streamed. */
export async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const src = fs.createReadStream(file);
    src.on('error', reject);
    src.on('data', (chunk) => hash.update(chunk));
    src.on('end', resolve);
  });
  return hash.digest('hex');
}

/**
 * Build the whole pack: every part file, the index and the manifest.
 *
 * @param {{ assetsRoot: string, outDir: string, app: string, partBytes: number, manifestName?: string,
 *           bases?: string[], log?: (msg: string) => void }} opts
 * @returns {Promise<{ manifest: object, index: object, totals: object }>}
 */
export async function buildArtPack(opts) {
  const log = opts.log ?? (() => {});
  const files = await listArtFiles(opts.assetsRoot);
  const parts = planParts(files, opts.partBytes);
  const manifestName = opts.manifestName || defaultManifestName(opts.app);
  const index = indexName(opts.app);

  await fsp.mkdir(opts.outDir, { recursive: true });

  const rawBytes = files.reduce((sum, f) => sum + f.size, 0);
  log(`packing ${files.length} file(s), ${rawBytes} raw bytes into ${parts.length} part(s) → ${opts.outDir}`);

  // The index: every shipped path → [size, sha256]. Hashing the files is the second sequential pass over the art.
  const indexFiles = {};
  for (let i = 0; i < files.length; i++) {
    indexFiles[files[i].rel] = [files[i].size, await sha256File(files[i].abs)];
    if ((i + 1) % 2000 === 0) log(`  hashed ${i + 1}/${files.length}`);
  }

  const partList = [];
  let totalPartBytes = 0;
  for (let i = 0; i < parts.length; i++) {
    const name = partName(opts.app, i);
    const outPath = path.join(opts.outDir, name);
    const stats = await writePart(outPath, parts[i].files.map((f) => ({ name: f.rel, abs: f.abs })));
    totalPartBytes += stats.bytes;
    partList.push({
      name,
      bytes: stats.bytes,
      sha256: stats.sha256,
      files: stats.files,
      rawBytes: stats.rawBytes,
    });
    log(`  ${name}: ${stats.files} files, ${mb(stats.rawBytes)} raw → ${mb(stats.bytes)}`);
  }

  const indexText = `${JSON.stringify({ format: PACK_FORMAT, app: opts.app, artId: opts.artId || readArtId(), count: files.length, rawBytes, files: indexFiles }, null, 0)}\n`;
  const indexPath = path.join(opts.outDir, index);
  await fsp.writeFile(indexPath, indexText, 'utf8');
  const indexBytes = Buffer.byteLength(indexText, 'utf8');
  const indexSha = createHash('sha256').update(indexText).digest('hex');

  const artId = opts.artId ?? readArtId();
  const manifest = {
    format: PACK_FORMAT,
    app: opts.app,
    // The art this pack holds. `app` below is informational (which release built it); `artId` is what decides
    // whether an app may use it (nodejs-template/assets.mjs, art-id.mjs).
    artId,
    container: CONTAINER,
    codec: DEFAULT_CODEC,
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    rawBytes,
    partBytes: totalPartBytes,
    index: { name: index, bytes: indexBytes, sha256: indexSha },
    parts: partList,
  };
  await fsp.writeFile(path.join(opts.outDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    manifest,
    index: { name: index, bytes: indexBytes, sha256: indexSha, count: files.length },
    totals: { files: files.length, rawBytes, partCount: parts.length, totalPartBytes },
  };
}

/**
 * `{format, app, manifest, bases, pointers}` — staged next to the entry point and baked into the APK.
 *
 * @param {{ app: string, bases: string[], manifestName?: string, pointers?: string[], file?: string }} opts
 */
export async function writeAssetPackJson(opts) {
  const payload = {
    format: PACK_FORMAT,
    app: opts.app,
    manifest: opts.manifestName || defaultManifestName(opts.app),
    bases: opts.bases,
    // Small, stable URLs whose content overrides `manifest` + `bases` at run time, so the parts can move to another
    // host (or another release) without rebuilding the APK. Tried in order; all of them failing is not an error.
    pointers: opts.pointers || [],
  };
  const file = opts.file ?? path.join(TEMPLATE, 'asset-pack.json');
  await fsp.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { file, payload };
}

// ---------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------
/** @returns {{ [key: string]: true | string }} */
export function parseArgs(argv) {
  const flags = {};
  const takesValue = new Set(['out', 'part-bytes', 'app', 'base', 'manifest-name', 'pointer', 'pointer-out']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const eq = arg.indexOf('=');
    const name = arg.slice(2, eq < 0 ? undefined : eq);
    if (!takesValue.has(name)) {
      if (eq >= 0) throw new Error(`--${name} does not take a value`);
      flags[name] = true;
      continue;
    }
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[++i];
    if (value === undefined) throw new Error(`--${name} needs a value`);
    if (name === 'base' || name === 'pointer') flags[name] = flags[name] ? `${flags[name]},${value}` : value;
    else flags[name] = value;
  }
  return flags;
}

export async function readAppVersion(npmPackage = path.join(APP, 'package.json')) {
  const pkg = JSON.parse(await fsp.readFile(npmPackage, 'utf8'));
  if (!pkg.version) throw new Error(`no "version" in ${npmPackage}`);
  return String(pkg.version);
}

const mb = (bytes) => `${(bytes / (1 << 20)).toFixed(1)} MB`;
const pct = (a, b) => (b === 0 ? 'n/a' : `${((a / b) * 100).toFixed(1)}%`);
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function main(argv) {
  let flags;
  try {
    flags = parseArgs(argv);
  } catch (err) {
    console.error(`ERROR: ${err.message}\n\n${HELP}`);
    process.exitCode = 1;
    return;
  }
  if (flags.help) {
    console.log(HELP);
    return;
  }
  for (const key of Object.keys(flags)) {
    if (!['out', 'part-bytes', 'app', 'base', 'manifest-name', 'pointer', 'pointer-out', 'dry-run', 'help'].includes(key)) {
      console.error(`ERROR: unknown option --${key}\n\n${HELP}`);
      process.exitCode = 1;
      return;
    }
  }

  const app = flags.app || (await readAppVersion());
  const partBytes = flags['part-bytes'] === undefined ? DEFAULT_PART_BYTES : Number(flags['part-bytes']);
  if (!Number.isFinite(partBytes) || partBytes <= 0) {
    console.error(`ERROR: --part-bytes must be a positive number, got ${JSON.stringify(flags['part-bytes'])}`);
    process.exitCode = 1;
    return;
  }
  const outDir = path.resolve(REPO, flags.out || DEFAULT_OUT);
  const assetsRoot = path.join(REPO, ASSETS_REL);
  const manifestName = flags['manifest-name'] || defaultManifestName(app);
  const bases = flags.base ? String(flags.base).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const pointers = flags.pointer ? String(flags.pointer).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const artId = readArtId();

  const started = Date.now();
  if (!fs.existsSync(assetsRoot)) {
    console.error(`ERROR: ${assetsRoot} is missing — run \`npm run setup\` in the repository root first.`);
    process.exitCode = 1;
    return;
  }

  if (flags['dry-run']) {
    const files = await listArtFiles(assetsRoot);
    const parts = planParts(files, partBytes);
    const rawBytes = files.reduce((sum, f) => sum + f.size, 0);
    console.log(`=== pack-art --dry-run (nothing written) ===`);
    console.log(`assets        ${assetsRoot}`);
    console.log(`out           ${outDir}`);
    console.log(`app           ${app}`);
    console.log(`art id        ${artId || '(no data/assets.json + data/local-assets.json: the app falls back to the app version)'}`);
    console.log(`part limit    ${mb(partBytes)} raw per part`);
    console.log(`files         ${files.length}`);
    console.log(`raw bytes     ${rawBytes} (${mb(rawBytes)})`);
    console.log(`parts         ${parts.length}`);
    const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 3);
    console.log(`largest file  ${largest.map((f) => `${f.rel} (${mb(f.size)})`).join(', ')}`);
    for (let i = 0; i < parts.length; i++) {
      console.log(`  ${partName(app, i)}: ${parts[i].files.length} files, ${mb(parts[i].rawBytes)} raw`);
    }
    console.log(`index         ${indexName(app)}`);
    console.log(`manifest      ${manifestName}`);
    if (bases.length) {
      console.log(`bases         ${bases.join(', ')}`);
      console.log(`asset-pack    ${path.join(TEMPLATE, 'asset-pack.json')}`);
    } else {
      console.log('asset-pack    (no --base given: nodejs-template/asset-pack.json is not written)');
    }
    if (pointers.length) console.log(`pointers      ${pointers.join(', ')}`);
    if (flags['pointer-out']) console.log(`pointer file  ${path.resolve(REPO, flags['pointer-out'])}`);
    console.log(`elapsed       ${secs(Date.now() - started)}`);
    return;
  }

  const { manifest, totals } = await buildArtPack({ assetsRoot, outDir, app, partBytes, manifestName, artId, log: (m) => console.log(m) });

  let assetPack = null;
  if (bases.length) {
    const written = await writeAssetPackJson({ app, bases, manifestName, pointers });
    assetPack = written.file;
  }
  let pointerFile = null;
  if (flags['pointer-out']) {
    pointerFile = path.resolve(REPO, flags['pointer-out']);
    await fsp.writeFile(pointerFile, `${JSON.stringify(pointerPayload({ app, manifestName, bases }), null, 2)}\n`, 'utf8');
  }

  console.log('\n=== summary ===');
  console.log(`app            ${app}`);
  console.log(`art id         ${artId || '(none)'}`);
  console.log(`files          ${totals.files}`);
  console.log(`raw bytes      ${totals.rawBytes} (${mb(totals.rawBytes)})`);
  console.log(`parts          ${totals.partCount}`);
  console.log(`total part bytes ${totals.totalPartBytes} (${mb(totals.totalPartBytes)})`);
  console.log(`ratio          ${pct(totals.totalPartBytes, totals.rawBytes)} of raw`);
  for (const part of manifest.parts) {
    console.log(`  ${part.name}: ${part.files} files, ${mb(part.rawBytes)} raw, ${mb(part.bytes)} part`);
  }
  console.log(`index          ${path.join(outDir, manifest.index.name)} (${manifest.index.bytes} bytes)`);
  console.log(`manifest       ${path.join(outDir, manifestName)}`);
  if (assetPack) console.log(`asset-pack     ${assetPack}`);
  if (pointerFile) console.log(`pointer        ${pointerFile}`);
  console.log(`elapsed        ${secs(Date.now() - started)}`);
}

// Only when run as a script; importing this module (the test suite does) must not pack anything.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
