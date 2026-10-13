// android/scripts/nodejs-template/community.mjs — the second way to get the game art on a phone: the repository's own
// fetch-assets pipeline, which pulls the files from the community dumps of the official client (the same sources a PC
// install uses, docs/ASSETS.md). It runs when our own art pack cannot be reached at all (SP_ASSET_SOURCE=community, or
// =auto after the pack failed) and it fills only what is missing, so a half-finished pack download continues here.
//
// Two things make this work inside the app:
//   * there is no second Node binary to spawn (the runtime is libnode inside the app), so fetch-assets.mjs is imported
//     in-process and its exported main(argv) is called directly;
//   * the art directory is `SP_ASSETS_DIR` (the same one the server serves /assets/ from), not public/assets of the
//     unpacked tree — that tree is deleted whenever the APK changes.
//
// What it cannot do, and why the launcher says "素材不完整": the community dumps carry no `assets/local/**` (the 3D
// battlefield scenes, mesh materials and the local-client enemy/token models come from an installed Arknights client
// via tools/local-extract, 84.7 MB packed). Those stay placeholders, and a later pack download fills them in.
//
// Node builtins only.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Where fetch-assets.mjs can be: the staged tree (next to this file) or this checkout (a desktop run of the template). */
function fetchAssetsUrl() {
  const candidates = [
    path.join(HERE, 'tools', 'fetch-assets.mjs'),
    path.resolve(HERE, '..', '..', '..', 'tools', 'fetch-assets.mjs'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return pathToFileURL(c).href;
  return null;
}

/** How many files of the index are on disk right now (progress for a run whose own output we cannot hook). */
async function countPresent(artDir, index) {
  let have = 0;
  for (const rel of Object.keys(index.files)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const st = await fsp.stat(path.join(artDir, ...rel.split('/')));
      if (st.isFile()) have++;
    } catch { /* missing */ }
  }
  return have;
}

/**
 * Fill the art directory from the community dumps. Resolves with `{ files, total, code }`; never throws for a mere
 * failure — the caller reports it. `code` is fetch-assets' own exit code (0 = everything the plan could resolve is on
 * disk; 1 = a required asset is still missing or the manifest would have shrunk).
 *
 * @param {{ artDir: string, index?: any, log?: Function, onProgress?: Function, signal?: AbortSignal, source?: string,
 *   args?: string[] }} opts  args: the flags fetch-assets runs with (default: what the app uses)
 */
export async function fillFromCommunity({ artDir, index = null, log = () => {}, onProgress = () => {}, signal = null, source = 'mirror', args = null }) {
  const url = fetchAssetsUrl();
  if (!url) return { code: -1, files: 0, total: 0, reason: 'tools/fetch-assets.mjs is not part of this build' };
  const total = index ? Object.keys(index.files).length : 0;
  log('[art] the art pack is unreachable — falling back to the community asset sources');

  // The pipeline writes into SP_ASSETS_DIR, which the entry point already set; the art has to be there before the
  // import, because fetch-assets.mjs reads it when it loads.
  process.env.SP_ASSETS_DIR = artDir;
  const mod = await import(url);

  let timer = null;
  if (total) {
    const tick = async () => {
      try {
        const have = await countPresent(artDir, index);
        onProgress({ phase: 'community', files: have, totalFiles: total, bytes: 0, totalBytes: 0 });
      } catch { /* the tree is being written; a failed probe is not an error */ }
    };
    timer = setInterval(() => { void tick(); }, 2000);
    void tick();
  }

  try {
    // --add-only: never re-download or rewrite a file that is already there (a resumed pack download stays intact),
    // and the shipped data/assets.json keeps its entries. --asset-source=mirror avoids the public-IP lookup and uses
    // the GitHub proxy prefix (SP_GITHUB_PROXY, https://gh-proxy.com/ by default) — raw.githubusercontent.com is not
    // reachable from many phone networks.
    const argv = args || ['--add-only', `--asset-source=${source}`];
    if (signal?.aborted) return { code: 0, files: 0, total, reason: 'cancelled' };
    const code = await mod.main(argv);
    return { code, files: total ? await countPresent(artDir, index) : 0, total };
  } catch (err) {
    return { code: 1, files: total ? await countPresent(artDir, index) : 0, total, reason: String(err?.message ?? err) };
  } finally {
    if (timer) clearInterval(timer);
  }
}

export default { fillFromCommunity };
