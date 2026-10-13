// android/scripts/art-set.mjs — the single place that decides which game art ships.
//
// Two consumers must agree on this, or a phone that downloaded the pack would miss files the APK build still ships:
//   * android/scripts/assemble-nodejs.mjs — the APK build (its local/scene prune follows this rule);
//   * android/scripts/pack-art.mjs        — the downloadable art pack.
//
// The art lives in `public/assets` of the game repository (it is git-ignored: it is produced by `npm run setup`).

import fsp from 'node:fs/promises';
import path from 'node:path';

/** Path of the art inside the repository, '/'-separated. */
export const ASSETS_REL = 'public/assets';

/**
 * True for files that are present in `public/assets` but must never ship.
 *
 * The 11 official battlefield scenes store their lightmap twice: the `.webp` the client actually loads, and the
 * `.png` the extractor wrote beside it. `data/local-assets.json` names 35 `.webp` (plus `.bin`/`.json`) under
 * `local/scene/` and no `.png` at all, so those `.png` files are ~26 MB that no client ever requests. The repository
 * keeps them (the extraction test checks a `.png` beside every `.webp`); the APK and the pack drop them.
 *
 * @param {string} rel  path relative to the assets root, '/' or '\' separated
 * @returns {boolean}
 */
export function isPrunedAsset(rel) {
  const norm = String(rel).replace(/\\/g, '/');
  const dir = norm.slice(0, norm.lastIndexOf('/') + 1); // everything up to and including the last '/'
  return dir.startsWith('local/scene/') && norm.toLowerCase().endsWith('.png');
}

/**
 * Every regular file under `assetsRoot` that ships, sorted by its '/'-separated relative path (byte order).
 *
 * @param {string} assetsRoot  absolute path of the assets root (…/public/assets)
 * @returns {Promise<{ rel: string, abs: string, size: number }[]>}
 */
export async function listArtFiles(assetsRoot) {
  const root = path.resolve(assetsRoot);
  const out = [];

  const walk = async (dir, prefix) => {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`art-set: no such directory: ${dir}`);
      throw err;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else if (entry.isFile()) {
        if (isPrunedAsset(rel)) continue;
        const stat = await fsp.stat(abs);
        out.push({ rel, abs, size: stat.size });
      }
      // Anything else (a symlink, a socket) is a directory entry, not a shippable regular file.
    }
  };

  await walk(root, '');
  out.sort((a, b) => Buffer.compare(Buffer.from(a.rel, 'utf8'), Buffer.from(b.rel, 'utf8')));
  return out;
}
