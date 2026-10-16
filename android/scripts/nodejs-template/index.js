// android/scripts/nodejs-template/index.js — entry point executed by the embedded Node.js runtime inside the app.
//
// The @jadejr/capacitor-nodejs plugin copies the whole webDir/nodejs tree out of the APK into the app's private
// files directory and then runs this file. Because this file sits next to copies of `server/`, `shared/`, `data/`
// and `public/`, server/index.js resolves its own ROOT to this directory and serves the game unmodified.
//
// Hosting is `lan/host.mjs`: the game server plus the UDP room beacon that lets other phones find this one (see
// lan/protocol.mjs for why that beacon has to exist at all).
//
// Game art (public/assets): the slim APK ships none of it — it is ~520 MB of the ~560 MB package. This file therefore
// points the server at an art directory *beside* the unpacked tree and, once the server is up, downloads and unpacks
// the parts published with the release (assets.mjs; docs/FORK-DEVIATIONS.md "首启下载素材"). That directory has to
// live outside `<files>/nodejs/public`, because the plugin deletes that whole tree whenever the APK version changes;
// `<files>/nodejs/art` survives. A phone whose art is already there skips the download entirely. The server keeps
// running whatever happens: files that are missing make the client draw its placeholders, and the launcher page
// decides what to tell the user.
//
// Communication with the launcher page goes over the plugin's built-in `bridge` module (a native CommonJS builtin
// that is only present inside the app, hence the createRequire + try/catch so the same file also runs under plain
// `node index.js` on a desktop for debugging).
//
// Env in:  SP_PORT (game server port, default 3000), SP_HOST_NAME (label shown on the other phone), SP_ART_DIR (the
// art directory; inside the app the default is `<cwd>/../art`), SP_SKIP_ART=1 (never download art this run),
// SP_PACK_BASE (pack source URLs, comma separated), SP_ASSET_SOURCE=auto|pack|community.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { startHost } from './lan/host.mjs';
import { ensureArt, artDirFrom, packBases, readArtId, readPackConfig, resolvePackSource } from './assets.mjs';
import { fillFromCommunity } from './community.mjs';

/**
 * Debug console (DESIGN §21.33), the switch this BUILD staged: `'auto'` = the server's own default (loopback clients
 * only: the app's own WebView, so the panel is there for single-player testing), `'1'` = every client of this app
 * (a test build — `build-apk.ps1 -Variant devtest` — where a friend joining over LAN may use it too), `'0'` = off
 * everywhere. `assemble-nodejs.mjs --console=…` rewrites the token below; an unrewritten token changes nothing, so
 * running this file directly (`node index.js`) leaves the server on its default. An SP_CONSOLE the platform sets wins.
 */
const consoleMode = '__SP_CONSOLE__';
if ((consoleMode === '0' || consoleMode === '1') && !process.env.SP_CONSOLE) process.env.SP_CONSOLE = consoleMode;

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** @type {{ channel?: { send: (eventName: string, ...args: unknown[]) => void, on: (eventName: string, cb: (...a: unknown[]) => void) => void } } | null} */
let bridge = null;
try {
  bridge = require('bridge');
} catch (err) {
  console.log('[sp] the Capacitor bridge module is not available — running standalone:', err?.message ?? err);
}

const channel = bridge?.channel ?? null;

/** Send a launcher event; a no-op when running outside the app. */
function send(eventName, ...args) {
  if (!channel) return;
  try {
    channel.send(eventName, ...args);
  } catch (err) {
    console.error(`[sp] failed to send "${eventName}" to the launcher:`, err);
  }
}

const port = Number(process.env.SP_PORT || process.env.PORT || 3000);
const hostName = process.env.SP_HOST_NAME || '';

// ---------------------------------------------------------------------------------------------------
// game art (public/assets): point the server at the durable directory, then fill it in the background
// ---------------------------------------------------------------------------------------------------
/**
 * The build this file was staged into: `assemble-nodejs.mjs --slim` (build-apk.ps1 -NoArt) rewrites the token below
 * to `'1'`. Only a slim build downloads art: the full APK carries `public/assets` inside itself, and pointing the
 * server at an empty `<files>/nodejs/art` there would make it wait for a 502 MB download it does not need. An
 * unrewritten token (running this file straight out of the source tree) means "not slim", like the console token.
 */
const slimBuild = '__SP_SLIM__' === '1';
/** This app's version, i.e. the version of the art pack it needs — the staged package.json is this app's own. */
const APP_VERSION = (() => {
  try { return String(JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version || ''); } catch { return ''; }
})();
/**
 * Inside a slim build the server runs with its working directory on the unpacked `public/`, so the art directory is
 * its sibling (outside the tree the Capacitor plugin deletes on an app update). `SP_ART_DIR` always wins, which is how
 * the same file is tested on a desktop; without it — the full build, or a desktop run — `SP_ASSETS_DIR` stays unset
 * and the server serves the bundled `public/assets` exactly as before.
 */
const artDir = artDirFrom(slimBuild && bridge ? path.resolve(process.cwd(), '..', 'art') : '');
if (artDir) process.env.SP_ASSETS_DIR = artDir;
/**
 * Plugins (0.3.0) live outside the unpacked project for the same reason the art does: the Capacitor plugin deletes the
 * whole project directory on every app update, so a plugin installed on the phone would vanish with it. The templates
 * and the schemas stay inside the project (`plugins/_template`, mirrored by android/scripts/assemble-nodejs.mjs) —
 * the Docker image splits the two the same way (`SP_PLUGIN_RESOURCES`).
 */
const pluginsDir = bridge ? path.resolve(process.cwd(), '..', 'plugins') : '';
if (pluginsDir) { try { fs.mkdirSync(pluginsDir, { recursive: true }); } catch { /* the server reports it */ } }
const pack = readPackConfig({ dir: HERE });
const bases = packBases(pack.bases);
/**
 * The art this build ships (`data/assets.json` + `data/local-assets.json`): the pack must hold exactly this art, and a
 * pack that does keeps working across app releases that only changed code (art-id.mjs).
 */
const ART_ID = readArtId(HERE);
/** Where the art may come from: `pack` (our own release parts), `community` (the dumps of the official client) or `auto`. */
const SOURCE = (process.env.SP_ASSET_SOURCE || 'auto').toLowerCase();

let cancelArt = new AbortController();
let artRun = null;

/** One line per state change for `adb logcat`; the launcher gets the same information as JSON events. */
function artLog(message) { console.log(`[art] ${message}`); }

/**
 * Download + unpack the art when it is not there yet. Never throws: a failure goes to the launcher and the server
 * keeps serving whatever is on disk (the client draws placeholders for what is missing).
 *
 * The pack is the fast path (ten part files, already post-processed, verified per file). When it cannot be reached at
 * all — no network to the release, a mirror that answers with something else — the community fallback fetches the same
 * art from the sources a PC install uses. It cannot provide `assets/local/**` (those come from a local Arknights
 * client), so a community-only phone keeps the placeholder board and a later pack download fills it in.
 *
 * @param {'start'|'retry'} why
 */
function prepareArt(why) {
  if (artRun) return artRun;
  artRun = (async () => {
    if (process.env.SP_SKIP_ART === '1') { send('art-skipped', JSON.stringify({ reason: 'SP_SKIP_ART', artDir })); return; }
    if (!artDir) { send('art-skipped', JSON.stringify({ reason: slimBuild ? 'no art directory' : 'this build ships the art', artDir })); return; }

    // ---- 1. our own pack -------------------------------------------------------------------------
    let packError = null;
    if (SOURCE !== 'community') {
      if (!bases.length || !pack.manifest) {
        packError = Object.assign(new Error(`没有配置素材包来源（缺少 ${pack.file}）`), { code: 'E_CONFIG' });
      } else {
        try {
          // Where the parts are right now, in order of precedence: an explicit `SP_PACK_BASE` (a developer or a
          // maintainer testing another host) wins; then a small pointer file, if the build was given one, which may
          // name another host, another release or another manifest; then the addresses baked into this APK. All
          // pointers failing is normal — it silently means "the baked list".
          const forced = (process.env.SP_PACK_BASE || '').trim();
          const source = forced
            ? { bases, manifestName: pack.manifest, source: 'SP_PACK_BASE' }
            : await resolvePackSource({ pointers: pack.pointers, bases, manifestName: pack.manifest, log: artLog, signal: cancelArt.signal });
          const res = await ensureArt({
            artDir,
            bases: source.bases,
            manifestName: source.manifestName,
            app: APP_VERSION,
            artId: ART_ID,
            log: artLog,
            signal: cancelArt.signal,
            onProgress: (p) => send('art-progress', JSON.stringify({ ...p, why, artDir, source: source.source })),
          });
          console.log(`[sp] art ${res.status}: ${res.files} files, ${Math.round(res.rawBytes / (1 << 20))} MB, ${res.seconds.toFixed(1)} s (pack from ${source.source})`);
          send('art-done', JSON.stringify({ status: res.status, files: res.files, rawBytes: res.rawBytes, bytes: res.bytes, seconds: res.seconds, why, artDir, source: source.source }));
          return;
        } catch (err) {
          if (err?.code === 'E_CANCELLED') { artLog('cancelled — the server keeps serving what is on disk'); send('art-skipped', JSON.stringify({ reason: 'cancelled', artDir })); return; }
          packError = err;
          console.error('[sp] the art pack failed:', err);
          artLog(`pack failed (${err?.code || 'E_UNKNOWN'}): ${err?.message ?? err}`);
        }
      }
    }

    if (SOURCE === 'pack') {
      send('art-error', JSON.stringify({ code: packError?.code || 'E_UNKNOWN', message: String(packError?.message ?? packError ?? 'no pack source'), why, artDir }));
      return;
    }

    // ---- 2. the community sources -----------------------------------------------------------------
    send('art-progress', JSON.stringify({ phase: 'fallback', why, artDir, message: String(packError?.message ?? '') }));
    const t0 = Date.now();
    const res = await fillFromCommunity({
      artDir,
      index: packError?.index || null,
      log: artLog,
      signal: cancelArt.signal,
      onProgress: (p) => send('art-progress', JSON.stringify({ ...p, why, artDir })),
    });
    const seconds = (Date.now() - t0) / 1000;
    if (cancelArt.signal.aborted) { send('art-skipped', JSON.stringify({ reason: 'cancelled', artDir })); return; }
    if (res.code === 0 && res.files > 0) {
      // Complete for everything the community sources cover — the local-client art (assets/local/**) is not part of
      // it; the launcher says so, and the next launch retries the pack for the rest.
      send('art-done', JSON.stringify({ status: 'community', files: res.files, rawBytes: 0, bytes: 0, seconds, partial: res.total > res.files, why, artDir }));
      return;
    }
    const reason = res.reason || (res.total ? `社区素材源只补齐了 ${res.files}/${res.total} 个文件` : '社区素材源没有可用的文件');
    send('art-error', JSON.stringify({
      code: 'E_PARTIAL',
      message: `${reason}；素材包本身的错误：${String(packError?.message ?? '无').slice(0, 200)}`,
      why,
      artDir,
      files: res.files,
      total: res.total,
    }));
  })().catch((err) => {
    console.error('[sp] the art step failed unexpectedly:', err);
    send('art-error', JSON.stringify({ code: 'E_UNKNOWN', message: String(err?.message ?? err), why, artDir }));
  }).finally(() => { artRun = null; });
  return artRun;
}

// The launcher can ask again after a failure and can stop a download that is taking too long; the server keeps
// running either way. The Node engine itself cannot be restarted (the plugin starts it once), so this is the retry.
if (channel?.on) {
  channel.on('retry-art', () => {
    cancelArt = new AbortController();
    artLog('retry requested by the launcher');
    void prepareArt('retry');
  });
  channel.on('skip-art', () => {
    artLog('cancelled by the launcher');
    cancelArt.abort();
  });
}

// ---------------------------------------------------------------------------------------------------
// the game server
// ---------------------------------------------------------------------------------------------------
try {
  // 0.0.0.0 so the other phones on the same Wi-Fi can reach this one.
  const host = await startHost({ port, name: hostName, log: (message) => console.log(message), pluginsDir });
  const { srv, announcer } = host;

  console.log(`[sp] listening on ${srv.url}${host.lan.length ? ` — LAN: ${host.lan.join(', ')}` : ' — no LAN address found'}`);
  if (announcer) {
    if (announcer.error) console.warn(`[sp] LAN discovery unavailable: ${announcer.error.message ?? announcer.error}`);
    else console.log(`[sp] LAN discovery active as ${announcer.id} (broadcast → :${announcer.hostPort})`);
  }

  send('server-ready', JSON.stringify({
    port: srv.port,
    local: `http://127.0.0.1:${srv.port}`,
    lan: host.lan,
    name: host.name,
    assets: { dir: artDir || null, pack: pack.manifest || null, sources: bases.length },
    plugins: pluginsDir || null,
    announce: announcer
      ? {
        id: announcer.id,
        hostPort: announcer.hostPort,
        seekPort: announcer.seekPort,
        error: announcer.error ? String(announcer.error.message ?? announcer.error) : null,
      }
      : null,
  }));

  // Only now: the room is up and joinable while the art arrives, and `server-ready` is not delayed by a download
  // that can take many minutes.
  void prepareArt('start');
} catch (err) {
  const message = err?.code === 'EADDRINUSE'
    ? `端口 ${port} 已被占用（可能已有一个服务器在运行）`
    : String(err?.message ?? err);
  console.error('[sp] failed to start the server:', err);
  send('server-error', JSON.stringify({ message }));
}
