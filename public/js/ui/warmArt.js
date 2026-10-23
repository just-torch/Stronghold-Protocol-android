// ui/warmArt.js — the battle's art, warmed in the background once the player is in a room (main.js warmGameData):
// the field's own sprites (backdrop mountains, the shadow under units, the empty skill icon), every profession icon and
// the bond / band discs of the strip (assets.js battleArtUrls). With the match's data files already loading, a match
// opens on art that is in the browser cache — on a weak link the first battle otherwise drew image-less placeholders
// for a while (art manifest / icons still downloading; user report: broken art while playing through a server).
//
// Nothing here blocks a screen: `warmBattleArt` runs after the data files, never rejects and is optional (a picture that
// fails keeps its placeholder — assets.js retries it twice first). The heavy sets are left to their own loaders: unit
// pictures follow the round's data (render/units.js), the official effects' atlas pages are loaded per battle
// (render/vfx/library.js), the board's three.js textures by the field (render/board3d/load.js).
//
// The asset store (public/js/assets.js) is imported only when this runs — the title page needs neither it nor its Spine
// cache (assets.js header), so the import is dynamic.

import { data } from '../data.js';

/**
 * Warm the art a battle draws. Idempotent: the store caches every URL's Promise, and a second call only re-walks URLs
 * that are already ready.
 * @param {{ assets?: any, manifest?: any, getRaw?: (name: string) => any }} [opts] tests / a view that already has the
 *   store; normally every field is resolved here (assets.js singleton, the data store's own copy of /data/assets.json)
 * @returns {Promise<{ ok: number, failed: number, total: number, skipped?: string }>} never rejects
 */
export async function warmBattleArt(opts = {}) {
  // a player who asked the browser to save data is not warmed behind their back (the pictures load on demand)
  const connection = globalThis.navigator && globalThis.navigator.connection;
  if (connection && connection.saveData === true) return { ok: 0, failed: 0, total: 0, skipped: 'save-data' };
  try {
    const mod = await import('../assets.js');
    const { battleArtUrls } = mod;
    const store = opts.assets || mod.assets;
    // the game data's own copy (data.js 'assets', already fetched by GAME_FILES) — the store would otherwise download it
    // again; the manifest's cosmetic layers are applied by the store itself when it builds the list
    const raw = opts.manifest || (typeof opts.getRaw === 'function' ? opts.getRaw('assets') : data.getRaw('assets'));
    // never adopt an empty / malformed copy (the store would freeze on it and draw every fallback)
    if (raw && typeof raw === 'object' && Object.keys(raw).length && typeof store.seed === 'function') store.seed(raw);
    const manifest = store.manifest || raw;
    if (!manifest || typeof store.preload !== 'function') return { ok: 0, failed: 0, total: 0 };
    const urls = battleArtUrls(manifest);
    if (!urls.length) return { ok: 0, failed: 0, total: 0 };
    return await store.preload(urls);
  } catch (err) {
    // a warm-up is optional: an unwritable store / a failed module import must not reach the caller
    console.warn('[warmArt] battle art warm-up failed', err && err.message ? err.message : err);
    return { ok: 0, failed: 0, total: 0 };
  }
}
