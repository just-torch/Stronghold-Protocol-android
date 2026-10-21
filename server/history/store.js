// server/history/store.js — the finished matches of this server, as files (DESIGN §21.58).
//
// Why here: the lobby already keeps the last match's frames for the reconnecting clients (lobby.buildReplay), but they
// live in memory and die with the room. A match record is what 「对局记录」 lists afterwards and what a 回放 replays: the
// result (victory / reason / rounds), the seats and — the part a replay needs — the battle specs each field ran.
//
//   <dir>/<id>.json   one finished match: meta + battles (the field specs, so a client re-simulates them from the start)
//   <dir>/index.json  the list (newest first, at most `limit` entries); rewritten on every record and prune
//
// A spec is the deterministic input of a battle (docs/SIM.md: the same spec on the same build replays byte for byte), so a
// record never stores frames — no snapshots, no event streams, no private state. `SP_HISTORY=off` turns recording off;
// the environment also names the directory (`SP_HISTORY_DIR`).
//
// The store is deliberately tiny and synchronous: one write per finished match (a few hundred KB at most), serialized by
// the caller (the lobby's onMatchEnd) and never on a hot path. A failure to write is logged and never fails a match.
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION } from '../../shared/constants.js';

const noopLog = { info() {}, warn() {}, error() {}, debug() {} };

/** Record format version. A reader refuses a record it does not know rather than guessing. */
export const HISTORY_VERSION = 1;

/** Default cap of the JSON a single record may take (the battle specs of a long match are the bulk of it). */
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

/** `SP_HISTORY`: off | on (default on). */
export function parseHistoryMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v || v === '1' || v === 'on' || v === 'yes') return 'on';
  if (v === '0' || v === 'off' || v === 'no') return 'off';
  return 'on';
}

const isId = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(v);

/**
 * The list entry of one record: everything the list shows, nothing a replay needs.
 * @param {object} r a record (see buildMatchRecord)
 */
export function summarize(r) {
  return {
    id: r.id, at: r.at, startedAt: r.startedAt ?? null, room: r.room ?? null,
    mode: r.mode ?? null, difficulty: r.difficulty ?? null, modeId: r.modeId ?? null,
    rounds: r.rounds ?? 0,
    result: r.result ? { victory: !!r.result.victory, reason: r.result.reason || null } : { victory: false, reason: null },
    players: (r.players || []).map((p) => ({ playerId: p.playerId, name: p.name, isBot: !!p.isBot, lp: p.lp ?? null })),
    battles: Array.isArray(r.battles) ? r.battles.length : 0,
    replayable: !!r.replayable,
  };
}

/**
 * A finished match as a record. Pure: the caller passes the match (its `fields` carry the specs) and the `m.result`
 * summary the lobby got from onEnd.
 *
 * @param {object} match a Match instance (read: players, fields, seed, modeId, difficulty, round)
 * @param {object} summary the onEnd summary (the m.result frame without `t`)
 * @param {{ room?: string, now?: number, startedAt?: number | null }} meta
 */
export function buildMatchRecord(match, summary, { room = null, now = Date.now(), startedAt = null } = {}) {
  const fields = Array.isArray(match && match.fields) ? match.fields : [];
  const battles = [];
  for (const f of fields) {
    if (!f) continue;
    // a field's spec: client combat stores it directly; a server-run field keeps it in Battle.opts (sim/Battle.js)
    const spec = f.spec || (f.battle && f.battle.opts) || null;
    if (!spec) continue;
    let result = f.result || null;
    if (!result && f.battle && typeof f.battle.result === 'function') {
      try { result = f.battle.result(); } catch { result = null; }
    }
    battles.push({
      fieldId: f.fieldId ?? spec.fieldId ?? null,
      kind: f.kind ?? spec.kind ?? 'normal',
      round: Number.isInteger(spec.round) ? spec.round : (match.round ?? 0),
      battleId: f.battleId || spec.battleId || null,
      spec,
      result,
    });
  }
  const players = [];
  if (match && match.players && typeof match.players.forEach === 'function') {
    for (const ps of match.players.values()) {
      // spectators are not players of the match; the summary carries only the seats
      players.push({ playerId: ps.playerId, name: ps.name, isBot: !!ps.isBot, seat: ps.seat ?? null, lp: ps.lp ?? null, connected: !!ps.connected });
    }
  }
  const id = `${now}-${room || 'room'}`;
  return {
    v: HISTORY_VERSION,
    id,
    at: now,
    startedAt,
    room,
    mode: summary?.mode ?? match?.mode ?? null,
    difficulty: summary?.difficulty ?? match?.difficulty ?? null,
    modeId: summary?.modeId ?? match?.modeId ?? null,
    rounds: Number.isInteger(summary?.roundsPassed) ? summary.roundsPassed : null,
    seed: match?.seed ?? null,
    app: APP_VERSION,
    result: { victory: !!(summary && summary.victory), reason: (summary && summary.reason) || null },
    players,
    battles,
    replayable: battles.length > 0,
  };
}

/**
 * The on-disk half: load the index, write a record, prune the oldest.
 * @param {{ dir: string, log?: object, limit?: number, maxBytes?: number }} opts
 */
export function createMatchHistory({ dir, log = noopLog, limit = 100, maxBytes = DEFAULT_MAX_BYTES }) {
  const root = path.resolve(dir);
  /** @type {{ id: string, at: number, room?: string, etc?: any }[]} newest first */
  let index = [];
  let loaded = false;

  const indexPath = () => path.join(root, 'index.json');
  const fileOf = (id) => path.join(root, `${id}.json`);

  function ensureDir() {
    fs.mkdirSync(root, { recursive: true });
  }

  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
      if (Array.isArray(raw)) index = raw.filter((e) => e && isId(e.id) && Number.isFinite(e.at)).sort((a, b) => b.at - a.at);
    } catch { index = []; }
  }

  function writeIndex() {
    ensureDir();
    const tmp = `${indexPath()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(index)}\n`);
    fs.renameSync(tmp, indexPath());
  }

  /**
   * Store one finished match. Returns the stored id, or null when it was skipped (a disabled store, a bad record).
   */
  function record(rec) {
    if (!rec || !isId(rec.id)) return null;
    ensureDir();
    let body = rec;
    let text = JSON.stringify(body);
    if (Buffer.byteLength(text) > maxBytes) {
      // too big for the cap: keep the meta and the result, drop what a replay needs (the record says so)
      body = { ...rec, battles: [], replayable: false, truncated: true };
      text = JSON.stringify(body);
    }
    const tmp = `${fileOf(rec.id)}.tmp`;
    fs.writeFileSync(tmp, `${text}\n`);
    fs.renameSync(tmp, fileOf(rec.id));
    load();
    index = [{ ...summarize(body), at: rec.at }, ...index.filter((e) => e.id !== rec.id)].sort((a, b) => b.at - a.at);
    prune();
    writeIndex();
    log.info(`[history] ${rec.id} recorded (${(rec.battles || []).length} battles${body.truncated ? ', specs dropped' : ''})`);
    return rec.id;
  }

  function prune() {
    if (index.length <= limit) return;
    const drop = index.slice(limit);
    index = index.slice(0, limit);
    for (const e of drop) {
      try { fs.unlinkSync(fileOf(e.id)); } catch { /* already gone */ }
    }
    if (drop.length) log.info(`[history] pruned ${drop.length} old match(es)`);
  }

  /** The list, newest first. */
  function list({ limit: n = limit } = {}) {
    load();
    return index.slice(0, Math.max(0, n | 0));
  }

  /** One record, or null (unknown id / unreadable file). */
  function load_record(id) {
    if (!isId(id)) return null;
    load();
    if (!index.some((e) => e.id === id)) return null;
    try {
      const rec = JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
      return rec && isId(rec.id) ? rec : null;
    } catch { return null; }
  }

  return { record, list, load: load_record, prune, get size() { load(); return index.length; }, dir: root };
}

/** Open the history the environment asks for (server/index.js): null when off. */
export function historyFromEnv(env, defaultDir, opts = {}) {
  if (parseHistoryMode(env.SP_HISTORY) === 'off') return null;
  const dir = typeof env.SP_HISTORY_DIR === 'string' && env.SP_HISTORY_DIR.trim() ? env.SP_HISTORY_DIR.trim() : defaultDir;
  return createMatchHistory({ dir, ...opts });
}
