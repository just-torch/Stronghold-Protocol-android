// android/scripts/nodejs-template/assets.mjs — first-launch game art: download, verify and unpack the part files
// published next to the APK (docs/FORK-DEVIATIONS.md "首启下载素材"; the format: android/scripts/pack-art.mjs and
// nodejs-template/art-container.mjs).
//
// Why this exists: the art (public/assets, ~660 MB raw / ~520 MB packed) is no longer inside the slim APK. The app
// unpacks the code into <files>/nodejs/public on every app update (the Capacitor plugin deletes that whole tree), so
// the art lives beside it in SP_ART_DIR (<files>/nodejs/art) and the server serves /assets/ from there
// (SP_ASSETS_DIR, server/http/static.js).
//
// Flow: the manifest (assets-pack-<app>.json, tried on every base URL in turn) names the parts and the index; the
// index (assets-index-<app>.json) holds size + sha256 of every shipped file. Each part is downloaded to
// <art>/.sp-tmp/ (resumable with an HTTP Range request), verified whole against the manifest, then streamed into the
// art tree while every file is hashed against the index — so what lands on disk is byte-exact or the part is retried.
// Progress is reported as a plain object; the caller turns it into bridge events for the launcher page.
//
// Node builtins only, and http/https rather than fetch: this file runs inside the embedded Node.js of the app
// (@jadejr/capacitor-nodejs, a nodejs-mobile build), where `fetch` is not guaranteed to be there but the http stack is.
//
// Env in (all optional): SP_PACK_BASE (comma-separated base URLs, overrides asset-pack.json), SP_ART_VERIFY=1 (hash the
// whole tree even when the state file says it is complete), SP_ART_RETRIES (attempts per part, default 3).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readPart, CONTAINER, DEFAULT_CODEC } from './art-container.mjs';
import { artIdFrom } from './art-id.mjs';

/** The state file inside the art directory (its presence + `complete` is the "art is ready" marker). */
export const STATE_FILE = '.sp-pack.json';
/** Where a part is downloaded before it is unpacked. */
export const TMP_DIR = '.sp-tmp';
/** The manifest format this file understands. */
export const PACK_FORMAT = 1;
/** Attempts per part (the first one, plus retries with backoff). */
const DEFAULT_RETRIES = 3;
/** Redirects followed for one request (GitHub release assets redirect to a CDN host). */
const MAX_REDIRECTS = 5;
/** How often progress is reported while bytes flow. */
const PROGRESS_MS = 200;
/**
 * Timeout for the two small files (manifest, index). Short on purpose: the bases are tried in order, and a source
 * that hangs instead of refusing (github.com from a phone network, see asset-pack.json) must not cost a minute
 * before the next one is tried. A part gets the longer MAX_REDIRECTS-timeout below: it is 50 MB, not 3 KB.
 */
const SMALL_FILE_TIMEOUT_MS = 30_000;
/** Timeout for one pointer (a 200-byte file on a host that may not answer at all). */
const POINTER_TIMEOUT_MS = 10_000;

/** An error the caller can act on: `code` is one of E_CONFIG / E_NETWORK / E_CORRUPT / E_DISK / E_CANCELLED. */
export class ArtError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ArtError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const human = (b) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(2)} GiB` : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MiB` : `${Math.round(b / 1024)} KiB`);
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Give a failure the code the callers act on. Errors that come out of the stream plumbing (`pipeline`, a destroyed
 * socket, a closed connection) are plain Errors, and `err.code` of those is a libuv string like 'ECONNRESET'.
 * @param {unknown} err @param {AbortSignal|null} [signal]
 */
function normalize(err, signal = null) {
  if (err instanceof ArtError) return err;
  const message = String(err?.message ?? err);
  if (signal?.aborted || /abort|cancel/i.test(message)) return new ArtError('E_CANCELLED', 'cancelled', { cause: err });
  return new ArtError('E_NETWORK', message, { cause: err });
}

/** Read + parse a JSON file, or null. */
async function readJson(abs) {
  try { return JSON.parse(await fsp.readFile(abs, 'utf8')); } catch { return null; }
}

/** Write a JSON file atomically (a state file half written by a killed app must never be read as complete). */
async function writeJson(abs, value) {
  const tmp = `${abs}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(value)}\n`);
  await fsp.rename(tmp, abs);
}

/**
 * Where the art lives for this run: the `SP_ART_DIR` the launcher/entry point decided, the given default, or null when
 * the feature is off (a desktop run of the same file: the bundled public/assets is served as always).
 * @param {string} [fallback]
 */
export function artDirFrom(fallback = '') {
  const env = (process.env.SP_ART_DIR || '').trim();
  if (env) return path.resolve(env);
  return fallback ? path.resolve(fallback) : '';
}

/**
 * The base URLs to try, in order: `SP_PACK_BASE` (comma/space separated) when set, else the baked-in list.
 * @param {string[]} baked
 */
export function packBases(baked = []) {
  const env = (process.env.SP_PACK_BASE || '').trim();
  const list = env ? env.split(/[\s,]+/) : baked;
  return list.map((u) => u.trim()).filter(Boolean).map((u) => (u.endsWith('/') ? u : `${u}/`));
}

/**
 * Read the baked-in pack description: `asset-pack.json` next to the entry point (staged by assemble-nodejs.mjs), or
 * `{ manifest, bases }` from the caller. Missing file → the caller's value (or an error).
 * `pointers` are the small, stable URLs whose content replaces `manifest` + `bases` at run time (resolvePackSource).
 * @param {{ dir: string, manifest?: string, bases?: string[] }} opts
 */
export function readPackConfig({ dir, manifest = '', bases = [] }) {
  const file = path.join(dir, 'asset-pack.json');
  const json = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  return {
    file,
    app: String(json?.app || ''),
    manifest: String(manifest || json?.manifest || ''),
    bases: bases.length ? bases : (Array.isArray(json?.bases) ? json.bases.map(String) : []),
    pointers: Array.isArray(json?.pointers) ? json.pointers.map(String) : [],
  };
}

/**
 * The art id of the manifests this build ships (`data/assets.json`, `data/local-assets.json` next to the entry point).
 * @param {string} dir the directory holding the entry point (the unpacked `<files>/nodejs/public`)
 * @returns {string} 12 hex characters, or '' when the files are missing
 */
export function readArtId(dir) {
  const read = (rel) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')); } catch { return null; }
  };
  return artIdFrom({ assets: read(path.join('data', 'assets.json')), local: read(path.join('data', 'local-assets.json')) });
}

/**
 * Where the parts are right now: a pointer is a tiny, stable JSON whose content overrides the baked-in addresses, so
 * moving 502 MB to another host (or another release) is a small commit instead of a new APK. Pointers are tried in
 * order with the small-file timeout; every one of them failing is normal and silently falls back to the baked list.
 *
 * @param {{ pointers?: string[], bases: string[], manifestName: string, log?: Function, signal?: AbortSignal|null }} opts
 * @returns {Promise<{ bases: string[], manifestName: string, source: string }>} source: the pointer URL or 'built in'
 */
export async function resolvePackSource({ pointers = [], bases = [], manifestName = '', log = () => {}, signal = null }) {
  for (const url of pointers) {
    try {
      log(`[art] pointer ${url}`);
      // eslint-disable-next-line no-await-in-loop
      const buf = await httpGetBuffer(url, { signal, timeoutMs: POINTER_TIMEOUT_MS });
      const json = JSON.parse(buf.toString('utf8'));
      const list = Array.isArray(json?.bases) ? json.bases.map(String).filter(Boolean) : [];
      if (json?.format !== PACK_FORMAT || !list.length) {
        log(`[art] pointer ${url} is not usable (format ${json?.format}, ${list.length} base(s))`);
        continue;
      }
      const normalised = list.map((u) => (u.endsWith('/') ? u : `${u}/`));
      const name = String(json.manifest || manifestName);
      log(`[art] using ${name} from ${normalised.length} base(s) named by that pointer`);
      return { bases: normalised, manifestName: name, source: url };
    } catch (err) {
      log(`[art] pointer ${url}: ${err.message}`);
    }
  }
  return { bases, manifestName, source: 'built in' };
}

// ---------------------------------------------------------------------------------------------------
// HTTP: one small get/redirect/range helper (no fetch: see the header). The response body is handed back as a
// stream so the caller can run it through `pipeline` — a phone downloads faster than it writes, and piping is what
// keeps a 64 MiB part from piling up in memory.
// ---------------------------------------------------------------------------------------------------

/**
 * GET a URL, following redirects, and resolve with the (unconsumed) response stream.
 * @param {string} url
 * @param {{ headers?: Record<string,string>, signal?: AbortSignal|null, timeoutMs?: number, redirects?: number }} [opts]
 * @returns {Promise<{ stream: import('node:stream').Readable, status: number, headers: import('node:http').IncomingHttpHeaders }>}
 */
function httpStream(url, { headers = {}, signal = null, timeoutMs = 60_000, redirects = MAX_REDIRECTS } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { reject(new ArtError('E_CONFIG', `invalid URL: ${url}`)); return; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new ArtError('E_CONFIG', `unsupported protocol: ${parsed.protocol}`));
      return;
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(parsed, { headers: { 'user-agent': 'stronghold-protocol-android', ...headers } }, (res) => {
      const status = res.statusCode || 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        if (redirects <= 0) { reject(new ArtError('E_NETWORK', `too many redirects for ${url}`)); return; }
        const next = new URL(location, parsed).toString();
        httpStream(next, { headers, signal, timeoutMs, redirects: redirects - 1 }).then(resolve, reject);
        return;
      }
      if (status !== 200 && status !== 206) {
        res.resume();
        reject(new ArtError('E_NETWORK', `HTTP ${status} for ${url}`, { status }));
        return;
      }
      resolve({ stream: res, status, headers: res.headers });
    });
    // A stalled connection must not hang the download forever: `setTimeout` covers the socket while the body flows.
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`timeout after ${timeoutMs} ms`)); });
    req.on('error', (err) => reject(new ArtError('E_NETWORK', `request failed: ${err.message}`, { cause: err })));
    if (signal) {
      const onAbort = () => req.destroy(new Error('cancelled'));
      if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/** GET a whole (small) file into memory. */
async function httpGetBuffer(url, opts = {}) {
  const { stream } = await httpStream(url, opts);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** GET JSON from the first base that answers, verifying nothing but the parse. */
async function fetchJsonFromBases(bases, name, { signal, onTry } = {}) {
  const errors = [];
  for (const base of bases) {
    const url = `${base}${name}`;
    try {
      onTry?.(url);
      const buf = await httpGetBuffer(url, { signal, timeoutMs: SMALL_FILE_TIMEOUT_MS });
      return { json: JSON.parse(buf.toString('utf8')), url, bytes: buf.length };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new ArtError('E_NETWORK', `could not fetch ${name} from any source:\n  ${errors.join('\n  ')}`);
}

// ---------------------------------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------------------------------

/** Free bytes on the filesystem holding `dir` (null when the platform cannot tell). */
async function freeBytes(dir) {
  try {
    const st = await fsp.statfs(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch { return null; }
}

/**
 * Whether the art tree looks complete according to the state file (and, with `verify`, according to the index).
 * @param {{ artDir: string, app?: string, verify?: boolean, index?: any, log?: Function }} opts
 */
export async function artComplete({ artDir, app = '', artId = '', verify = false, index = null, log = () => {} }) {
  const state = await readJson(path.join(artDir, STATE_FILE));
  if (!state || state.complete !== true || state.format !== PACK_FORMAT) return false;
  // Same rule as the pack itself: the art decides when both sides know it, the app version otherwise.
  if (state.artId || artId) {
    if (state.artId !== artId) { log(`[art] the art in ${artDir} is ${state.artId || '(unknown)'}, this build ships ${artId || '(unknown)'}`); return false; }
  } else if (app && state.app !== app) {
    log(`[art] the art in ${artDir} is for app ${state.app}, this app is ${app}`);
    return false;
  }
  if (!verify || !index) return true;
  let checked = 0;
  let bytes = 0;
  for (const [rel, [size, hash]] of Object.entries(index.files)) {
    const abs = path.join(artDir, ...rel.split('/'));
    let st;
    try { st = await fsp.stat(abs); } catch { log(`[art] missing ${rel}`); return false; }
    if (!st.isFile() || st.size !== size) { log(`[art] ${rel} is ${st.size} B, expected ${size} B`); return false; }
    // eslint-disable-next-line no-await-in-loop
    const got = sha256(await fsp.readFile(abs));
    if (got !== hash) { log(`[art] ${rel} has the wrong bytes`); return false; }
    checked++;
    bytes += size;
  }
  log(`[art] verified ${checked} files, ${human(bytes)}`);
  return true;
}

/**
 * Make the art tree complete: verify it, or download + unpack what is missing.
 *
 * @param {{
 *   artDir: string, bases: string[], manifestName: string, app?: string, artId?: string, log?: Function,
 *   onProgress?: (p: object) => void, signal?: AbortSignal, retries?: number, verify?: boolean,
 * }} opts
 *   app: this app's version — informational, used only when the pack carries no `artId` (a pack built before 0.2.6)
 *   artId: the art this build ships (readArtId) — the pack must hold exactly that art, whatever app version built it
 * @returns {Promise<{ status: 'complete' | 'downloaded', files: number, rawBytes: number, bytes: number, seconds: number }>}
 */
export async function ensureArt({ artDir, bases, manifestName, app = '', artId = '', log = () => {}, onProgress = () => {}, signal = null, retries = DEFAULT_RETRIES, verify = process.env.SP_ART_VERIFY === '1' }) {
  if (!artDir) throw new ArtError('E_CONFIG', 'no art directory');
  if (!bases.length) throw new ArtError('E_CONFIG', 'no pack source (asset-pack.json / SP_PACK_BASE)');
  if (!manifestName) throw new ArtError('E_CONFIG', 'no pack manifest name (asset-pack.json)');
  await fsp.mkdir(artDir, { recursive: true });
  const started = Date.now();

  // 0. the fast path: the state file says a verified tree is already here, and it is the tree this build ships. Then
  // there is nothing to fetch at all — no manifest, no 1.5 MB index, no network — which is what a second launch and
  // every launch after an app update that did not change the art should look like. SP_ART_VERIFY=1 skips this and
  // re-hashes everything against the index below.
  if (!verify && (artId || app)) {
    const state = await readJson(path.join(artDir, STATE_FILE));
    if (state?.complete === true && state.format === PACK_FORMAT
      && (state.artId || artId ? state.artId === artId : state.app === app)) {
      log(`[art] already complete: ${state.files ?? '?'} files, ${human(Number(state.rawBytes) || 0)} (art ${state.artId || state.app})`);
      onProgress({ phase: 'done', bytes: 0, totalBytes: 0, speedBps: 0, etaMs: 0 });
      return { status: 'complete', files: Number(state.files) || 0, rawBytes: Number(state.rawBytes) || 0, bytes: 0, seconds: (Date.now() - started) / 1000, index: null };
    }
  }

  // 1. the manifest — the only thing that decides whether there is anything to do at all
  onProgress({ phase: 'manifest', bytes: 0, totalBytes: 0 });
  const { json: manifest, url: manifestUrl } = await fetchJsonFromBases(bases, manifestName, { signal });
  if (manifest?.format !== PACK_FORMAT) throw new ArtError('E_CORRUPT', `${manifestUrl}: format ${manifest?.format} is not ${PACK_FORMAT}`);
  if (manifest.container !== CONTAINER) throw new ArtError('E_CORRUPT', `${manifestUrl}: container ${manifest.container} is not ${CONTAINER}`);
  if (manifest.codec !== DEFAULT_CODEC) throw new ArtError('E_CORRUPT', `${manifestUrl}: codec ${manifest.codec} is not ${DEFAULT_CODEC}`);
  if (!Array.isArray(manifest.parts) || !manifest.parts.length) throw new ArtError('E_CORRUPT', `${manifestUrl}: no parts`);
  // The art, not the version, decides: an app keeps using the pack it already has when a release only changed code.
  // A pack without `artId` (built before 0.2.6) falls back to the app version, which is what those packs were for.
  if (manifest.artId) {
    if (artId && manifest.artId !== artId) {
      throw new ArtError('E_CORRUPT', `${manifestUrl}: the pack holds art ${manifest.artId}, this build ships ${artId}`);
    }
  } else if (app && manifest.app && manifest.app !== app) {
    throw new ArtError('E_CORRUPT', `${manifestUrl}: the pack is for app ${manifest.app} (it names no art), this app is ${app}`);
  }
  log(`[art] pack ${manifest.artId || `for app ${manifest.app}`}: ${manifest.fileCount} files, ${human(manifest.rawBytes)} raw in ${manifest.parts.length} part(s) (${human(manifest.partBytes)})`);
  log(`[art] manifest from ${manifestUrl}`);

  // 2. the index (needed even for the "already complete" check: it says what the tree must hold)
  onProgress({ phase: 'index', bytes: 0, totalBytes: 0 });
  const indexBuf = await httpGetBuffer(new URL(manifest.index.name, manifestUrl).toString(), { signal, timeoutMs: SMALL_FILE_TIMEOUT_MS })
    .catch(async (err) => {
      // the index may live on another base than the manifest did (mirrors of the same release)
      for (const base of bases) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await httpGetBuffer(`${base}${manifest.index.name}`, { signal, timeoutMs: SMALL_FILE_TIMEOUT_MS });
        } catch { /* try the next base */ }
      }
      throw err;
    });
  if (manifest.index.bytes && indexBuf.length !== manifest.index.bytes) throw new ArtError('E_CORRUPT', `the index is ${indexBuf.length} B, expected ${manifest.index.bytes} B`);
  if (manifest.index.sha256 && sha256(indexBuf) !== manifest.index.sha256) throw new ArtError('E_CORRUPT', 'the index has the wrong sha256');
  const index = JSON.parse(indexBuf.toString('utf8'));
  if (!index?.files || typeof index.files !== 'object') throw new ArtError('E_CORRUPT', 'the index has no files');
  const fileCount = Object.keys(index.files).length;
  if (manifest.fileCount && fileCount !== manifest.fileCount) throw new ArtError('E_CORRUPT', `the index lists ${fileCount} files, the manifest says ${manifest.fileCount}`);
  log(`[art] index: ${fileCount} files`);

  // 3. already there?
  if (await artComplete({ artDir, app, artId, verify, index, log })) {
    return { status: 'complete', files: fileCount, rawBytes: manifest.rawBytes || index.rawBytes || 0, bytes: 0, seconds: (Date.now() - started) / 1000, index };
  }

  // 4. room to unpack into?
  const free = await freeBytes(artDir);
  const needed = Number(manifest.rawBytes || index.rawBytes || 0) + Math.max(...manifest.parts.map((p) => Number(p.rawBytes || p.bytes || 0)));
  if (free != null && free < needed) {
    throw new ArtError('E_DISK', `not enough space: ${human(free)} free, about ${human(needed)} needed`, { free, needed });
  }

  const tmpDir = path.join(artDir, TMP_DIR);
  await fsp.mkdir(tmpDir, { recursive: true });
  const statePath = path.join(artDir, STATE_FILE);
  const state = (await readJson(statePath)) || {};
  const sameArtSet = state.artId ? state.artId === (manifest.artId || artId) : state.app === (manifest.app || app);
  const parts = { ...(sameArtSet ? state.parts : {}) };
  const totalBytes = manifest.parts.reduce((sum, p) => sum + Number(p.bytes || 0), 0);
  let doneBytes = manifest.parts.reduce((sum, p) => (parts[p.name]?.sha256 === p.sha256 ? sum + Number(p.bytes || 0) : sum), 0);
  let speed = 0;
  let lastEmit = 0;
  let lastKey = '';
  let lastMark = { t: Date.now(), bytes: 0 };

  /**
   * Report progress. One bridge message per received chunk would flood the launcher (and the JNI hop between the
   * Node process and the WebView), so byte progress is throttled to PROGRESS_MS while a phase or a part changes
   * immediately.
   */
  const report = (extra) => {
    const now = Date.now();
    const bytesNow = doneBytes + Number(extra?.partBytes || 0);
    const dt = now - lastMark.t;
    if (dt > 500) {
      speed = (bytesNow - lastMark.bytes) / (dt / 1000);
      lastMark = { t: now, bytes: bytesNow };
    }
    const key = `${extra?.phase || ''}:${extra?.part || ''}:${extra?.partIndex || ''}`;
    if (key === lastKey && now - lastEmit < PROGRESS_MS) return;
    lastEmit = now;
    lastKey = key;
    onProgress({
      bytes: bytesNow, totalBytes, speedBps: Math.max(0, speed),
      etaMs: speed > 0 ? Math.max(0, ((totalBytes - bytesNow) / speed) * 1000) : null,
      ...extra,
    });
  };

  const t0 = Date.now();
  for (let i = 0; i < manifest.parts.length; i++) {
    const part = manifest.parts[i];
    if (signal?.aborted) throw new ArtError('E_CANCELLED', 'cancelled');
    if (parts[part.name]?.sha256 === part.sha256) {
      doneBytes += Number(part.bytes || 0);
      report({ phase: 'download', part: part.name, partIndex: i + 1, parts: manifest.parts.length, partBytes: 0 });
      continue;
    }
    const tmp = path.join(tmpDir, part.name);
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        // eslint-disable-next-line no-await-in-loop
        await downloadPart({ part, tmp, bases, log, signal, onBytes: (n) => report({ phase: 'download', part: part.name, partIndex: i + 1, parts: manifest.parts.length, partBytes: n }) });
        // eslint-disable-next-line no-await-in-loop
        const unpacked = await unpackPart({ part, tmp, artDir, index, log, signal, onProgress: (n) => report({ phase: 'unpack', part: part.name, partIndex: i + 1, parts: manifest.parts.length, partBytes: 0, filesDone: n }) });
        parts[part.name] = { sha256: part.sha256, files: unpacked.files, bytes: part.bytes };
        // eslint-disable-next-line no-await-in-loop
        await writeJson(statePath, { format: PACK_FORMAT, app: manifest.app || app, artId: manifest.artId || artId, manifest: manifestName, complete: false, parts });
        // eslint-disable-next-line no-await-in-loop
        await fsp.rm(tmp, { force: true });
        doneBytes += Number(part.bytes || 0);
        lastMark = { t: Date.now(), bytes: doneBytes };
        log(`[art] part ${i + 1}/${manifest.parts.length} done (${unpacked.files} files)`);
        break;
      } catch (raw) {
        const err = normalize(raw, signal);
        if (err.code === 'E_CANCELLED') throw err;
        if (attempt >= retries) {
          // The index goes along: the caller's community fallback reports its progress against it (index.js).
          err.index = index;
          throw err;
        }
        const wait = 1000 * attempt;
        log(`[art] part ${part.name} failed (${err.message}) — retrying in ${wait} ms (${attempt}/${retries})`);
        report({ phase: 'retry', part: part.name, partIndex: i + 1, parts: manifest.parts.length, partBytes: 0, message: String(err.message || err) });
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  await writeJson(statePath, {
    format: PACK_FORMAT, app: manifest.app || app, artId: manifest.artId || artId, manifest: manifestName, complete: true,
    files: fileCount, rawBytes: manifest.rawBytes || index.rawBytes || 0, bytes: totalBytes,
    parts, finishedAt: new Date().toISOString(),
  });
  const seconds = (Date.now() - t0) / 1000;
  log(`[art] complete: ${fileCount} files, ${human(manifest.rawBytes || 0)} unpacked in ${seconds.toFixed(1)} s`);
  onProgress({ phase: 'done', bytes: totalBytes, totalBytes, speedBps: 0, etaMs: 0 });
  return { status: 'downloaded', files: fileCount, rawBytes: manifest.rawBytes || 0, bytes: totalBytes, seconds, index };
}

/**
 * Download one part to `tmp`, resuming from what is already there. Verifies size + sha256 of the finished file.
 */
async function downloadPart({ part, tmp, bases, log, signal, onBytes }) {
  const want = Number(part.bytes || 0);
  let have = 0;
  try { have = (await fsp.stat(tmp)).size; } catch { have = 0; }
  if (have > want) { await fsp.rm(tmp, { force: true }); have = 0; }
  if (have === want) {
    const got = sha256(await fsp.readFile(tmp));
    if (got === part.sha256) { log(`[art] ${part.name}: already downloaded`); return; }
    await fsp.rm(tmp, { force: true });
    have = 0;
  }
  let lastError = null;
  /** A resume that produced the wrong bytes is worthless: this part is fetched from 0 for the rest of the run. */
  let noResume = false;
  let attempt = 0;
  while (attempt < bases.length + 1) {
    const base = bases[attempt % bases.length];
    attempt++;
    const url = `${base}${part.name}`;
    // What is really on disk decides where a resume starts (a stream that was destroyed mid-write may have flushed
    // less than the caller counted).
    if (!noResume) have = await fsp.stat(tmp).then((s) => s.size, () => 0);
    const resume = have > 0 && !noResume;
    try {
      if (resume) log(`[art] resuming ${part.name} at ${human(have)} of ${human(want)}`);
      const { stream } = await httpStream(url, { headers: resume ? { range: `bytes=${have}-` } : {}, signal });
      const out = fs.createWriteStream(tmp, { flags: resume ? 'a' : 'w' });
      let written = resume ? have : 0;
      // Count through a Transform and pipe: this is what applies backpressure (a phone's flash is slower than its
      // network, and without piping the whole part would be buffered in memory).
      const counter = new Transform({
        transform(chunk, _enc, cb) {
          written += chunk.length;
          if (signal?.aborted) { cb(new ArtError('E_CANCELLED', 'cancelled')); return; }
          onBytes(written);
          cb(null, chunk);
        },
      });
      await pipeline(stream, counter, out);
      const st = await fsp.stat(tmp);
      if (want && st.size !== want) throw new ArtError('E_CORRUPT', `${part.name}: ${st.size} B downloaded, expected ${want} B`);
      const got = sha256(await fsp.readFile(tmp));
      if (got !== part.sha256) {
        await fsp.rm(tmp, { force: true });
        throw new ArtError('E_CORRUPT', `${part.name}: sha256 ${got.slice(0, 12)}… but the manifest says ${String(part.sha256).slice(0, 12)}…`);
      }
      return;
    } catch (raw) {
      const err = normalize(raw, signal);
      lastError = err;
      if (err.code === 'E_CANCELLED') throw err;
      if (err.code === 'E_CORRUPT') {
        if (resume) {
          // Most likely the server ignored the Range header and answered with the whole file, which got appended to
          // what was already there. Start this part over (once) instead of failing a part that is probably fine.
          log(`[art] ${part.name}: the resume did not add up — downloading it from the start`);
          await fsp.rm(tmp, { force: true });
          have = 0;
          noResume = true;
          continue;
        }
        throw err;   // a full download with the wrong bytes: the source itself is not what the manifest describes
      }
      log(`[art] ${part.name}: ${err.message} (${base})`);
      // The connection broke: whatever is on disk is a prefix of the part, so the next attempt continues from there.
    }
  }
  throw lastError || new ArtError('E_NETWORK', `${part.name}: no source worked`);
}

/** A path stored in a container: relative, '/'-separated, no dot segments, inside the art tree. */
export function isSafeRel(rel) {
  if (typeof rel !== 'string' || !rel) return false;
  if (rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) return false;
  return rel.split('/').every((s) => s && s !== '.' && s !== '..');
}

/**
 * Unpack one part into the art tree, hashing every file against the index. Returns `{ files, bytes }`.
 * Every record must be listed by the index with the same size and sha256: the pack and the manifest can never drift.
 */
async function unpackPart({ part, tmp, artDir, index, log, signal, onProgress = () => {} }) {
  let files = 0;
  let bytes = 0;
  for await (const rec of readPart(tmp, { codec: DEFAULT_CODEC })) {
    if (signal?.aborted) throw new ArtError('E_CANCELLED', 'cancelled');
    if (!isSafeRel(rec.name)) throw new ArtError('E_CORRUPT', `${part.name}: unsafe path ${JSON.stringify(rec.name)}`);
    const entry = index.files[rec.name];
    if (!entry) throw new ArtError('E_CORRUPT', `${part.name}: ${rec.name} is not in the index`);
    const [size, hash] = Array.isArray(entry) ? entry : [entry.size, entry.sha256];
    if (rec.data.length !== size) throw new ArtError('E_CORRUPT', `${part.name}: ${rec.name} is ${rec.data.length} B, the index says ${size} B`);
    const got = sha256(rec.data);
    if (got !== hash) throw new ArtError('E_CORRUPT', `${part.name}: ${rec.name} has the wrong sha256`);
    const abs = path.join(artDir, ...rec.name.split('/'));
    // eslint-disable-next-line no-await-in-loop
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    const tmpFile = `${abs}.part-tmp`;
    // eslint-disable-next-line no-await-in-loop
    await fsp.writeFile(tmpFile, rec.data);
    // eslint-disable-next-line no-await-in-loop
    await fsp.rename(tmpFile, abs);
    files++;
    bytes += rec.data.length;
    if (files % 25 === 0) onProgress(files);
  }
  if (part.files && files !== part.files) throw new ArtError('E_CORRUPT', `${part.name}: ${files} files, the manifest says ${part.files}`);
  if (part.rawBytes && bytes !== part.rawBytes) throw new ArtError('E_CORRUPT', `${part.name}: ${human(bytes)} unpacked, the manifest says ${human(part.rawBytes)}`);
  return { files, bytes };
}

export default { ensureArt, artComplete, artDirFrom, packBases, readPackConfig, ArtError, STATE_FILE, TMP_DIR };
