// server/http/media.js — the extension-less audio route /media/… → <the assets root>/audio (see serveMedia).
// (i18n-ignore-file: the error pages are bilingual by design, 中文 · English — docs/I18N.md)

import fsp from 'node:fs/promises';
import path from 'node:path';
import { AUDIO_EXTS } from '../../shared/media.js';
import { sendError } from './common.js';
import { serveFile } from './files.js';

/**
 * The `audio` directories a `/media/…` request is looked up in, in order: the external art directory when one is
 * configured (`assetsDir` / SP_ASSETS_DIR, an absolute or relative path), then the bundled `<publicDir>/assets`.
 * `''` / null stand for "not configured" and are skipped.
 * @param {string} publicDir
 * @param {string} [assetsDir]
 * @returns {string[]} absolute paths
 */
export function mediaRoots(publicDir, assetsDir) {
  const roots = [];
  if (assetsDir) roots.push(path.join(path.resolve(assetsDir), 'audio'));
  roots.push(path.join(path.resolve(publicDir), 'assets', 'audio'));
  return roots;
}

/**
 * Extension-less audio route: `/media/bgm/act1` → `<root>/bgm/act1.mp3`, the first root in mediaRoots() holding it.
 *
 * Clients ask for audio through this path because download managers (IDM, 迅雷, FDM …) hijack XHR/fetch whose
 * URL ends in a media extension and pop a "下载文件信息" dialog for every BGM track — see `public/js/media.js`.
 * Requests for the direct `/assets/audio/…` URLs keep working (they are the fallback for plain static hosts).
 * `MEDIA_PREFIX` / `AUDIO_EXTS` live in `shared/media.js`: the browser decides which URLs to rewrite with the
 * same two values, and they must not drift apart.
 * @param {string} rest the request path after the /media/ prefix (`bgm/act1`)
 * @param {string[]} roots the `audio` directories to try, in order — see mediaRoots()
 */
export async function serveMedia(req, res, rest, query, roots, gzipCache, log) {
  const segments = String(rest || '').split('/').filter((s) => s.length > 0);
  if (!segments.length || rest.endsWith('/')) { sendError(req, res, 404, '页面不存在 · Not found'); return; }
  if (segments.some((s) => s === '..' || s === '.')) { sendError(req, res, 403, '禁止访问 · Forbidden'); return; }
  // A leading or trailing dot would address something else (dotfiles, "x..mp3") — and the client never asks for it.
  if (segments.some((s) => s.startsWith('.') || s.endsWith('.'))) { sendError(req, res, 404, '页面不存在 · Not found'); return; }

  const last = segments[segments.length - 1];
  const given = path.extname(last).toLowerCase();
  const wanted = AUDIO_EXTS.includes(given) ? given : '';
  const stem = wanted ? last.slice(0, -wanted.length) : last;
  if (!stem || stem.startsWith('.')) { sendError(req, res, 404, '页面不存在 · Not found'); return; }

  // An explicit extension wins (`/media/bgm.ogg` → bgm.ogg), otherwise the usual order decides.
  const order = wanted ? [wanted, ...AUDIO_EXTS.filter((e) => e !== wanted)] : AUDIO_EXTS;
  // The roots are absolute (mediaRoots), so `dir`/`absPath` stay inside one of them; the prefix guards are the same
  // defence the single-root version had. The first root holding the file wins — the external art dir, else public/assets.
  for (const root of roots) {
    const dir = path.join(root, ...segments.slice(0, -1));
    if (dir !== root && !dir.startsWith(root + path.sep)) continue;
    for (const ext of order) {
      const absPath = path.join(dir, stem + ext);
      if (!absPath.startsWith(root + path.sep)) continue;
      let stat;
      try {
        stat = await fsp.stat(absPath);
      } catch { continue; }
      if (!stat.isFile()) continue;
      // serveFile decides Content-Type from the resolved name (`.mp3` → audio/mpeg) — Range/ETag handling is shared.
      // Cache policy is that of the public path the client would otherwise have asked for (`/assets/audio/…`, 1 day).
      await serveFile(req, res, absPath, stat, 'public', ['assets', 'audio', ...segments], query, gzipCache, log);
      return;
    }
  }
  sendError(req, res, 404, '页面不存在 · Not found');
}
