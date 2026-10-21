// public/js/ui/historyClient.js — the 对局记录 API client (DESIGN §21.58).
//
// GET /api/history returns the finished matches of this server (newest first, list entries only); /api/history/<id>
// returns one record including its battles' specs. Everything is no-store on the server side, so a plain fetch is right;
// the record cache below is per page load (a replay never asks twice) and the list is re-fetched on every open, because a
// match may have finished while the page sat on the title screen.
const LIST_CACHE_MS = 5000;

let listCache = null;   // { at, value }
const recordCache = new Map();
const inflight = new Map();

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * The list of finished matches. `status` is 'ok' | 'error'; a server with the feature off has no route at all (504/404),
 * which the UI shows as 「这台服务器没有开启对局记录」 rather than an error.
 * @returns {Promise<{ status: 'ok' | 'off' | 'error', matches: object[], error?: string }>}
 */
export async function loadServerHistory({ limit = 50, fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && listCache && now - listCache.at < LIST_CACHE_MS) return listCache.value;
  try {
    const data = await getJson(`/api/history?limit=${encodeURIComponent(limit)}`);
    const value = { status: 'ok', matches: Array.isArray(data?.matches) ? data.matches : [] };
    listCache = { at: now, value };
    return value;
  } catch (e) {
    // a 404 means the server has no store (SP_HISTORY=off); anything else is a real failure
    const value = { status: e && e.status === 404 ? 'off' : 'error', matches: [], error: e && e.message ? e.message : String(e) };
    return value;
  }
}

/**
 * One record with its battles. Cached per page load; a second call for the same id resolves at once.
 * @param {string} id
 * @returns {Promise<{ ok: true, record: object } | { ok: false, error: string }>}
 */
export async function loadServerRecord(id, { fresh = false } = {}) {
  if (!id) return { ok: false, error: 'no id' };
  if (!fresh && recordCache.has(id)) return { ok: true, record: recordCache.get(id) };
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    try {
      const rec = await getJson(`/api/history/${encodeURIComponent(id)}`);
      if (!rec || typeof rec !== 'object' || !Array.isArray(rec.battles)) return { ok: false, error: 'bad record' };
      recordCache.set(id, rec);
      return { ok: true, record: rec };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}

/** Forget the caches (a test, or after a match ends on this page). */
export function clearHistoryCache() {
  listCache = null;
  recordCache.clear();
  inflight.clear();
}
