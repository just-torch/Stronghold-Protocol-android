// test/match/history.test.js — the finished-match store (DESIGN §21.58).
//
// Two halves: buildMatchRecord (what a match hands to the store, pure) and createMatchHistory (one JSON per match + the
// index, the prune, the size cap, the id guard). The API that serves them is covered by test/http/history-api.test.js.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildMatchRecord, createMatchHistory, parseHistoryMode, summarize, HISTORY_VERSION } from '../../server/history/store.js';
import { startServer } from '../../server/index.js';
import { TestClient } from '../helpers/wsClient.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sp-history-'));

/** A match stand-in: players is a Map (PlayerState-like), fields carry specs / battles. */
function fakeMatch({ battleSeed = 1, rounds = 3, players = [{ playerId: 'p_0', name: 'P0' }] } = {}) {
  return {
    mode: 'solo', difficulty: 'NORMAL', modeId: 'NORMAL', seed: battleSeed, round: rounds,
    players: new Map(players.map((p, i) => [p.playerId, { ...p, isBot: false, seat: i, lp: 7, connected: true }])),
    fields: [
      { fieldId: 'n:p_0', kind: 'normal', spec: { fieldId: 'n:p_0', kind: 'normal', round: 3, battleId: 'b.3.1', spawns: [] } },
      { fieldId: 'n:p_1', kind: 'normal', battle: { opts: { fieldId: 'n:p_1', kind: 'normal', round: 3, battleId: 'b.3.2' }, result: () => ({ killed: 4, total: 4 }) } },
      { fieldId: 'n:p_2', kind: 'normal' }, // no spec anywhere: not replayable, skipped
    ],
  };
}

const summary = { victory: true, reason: 'cleared', roundsPassed: 3, modeId: 'NORMAL' };

test('buildMatchRecord: the battles of a match, their specs and results', () => {
  const rec = buildMatchRecord(fakeMatch(), summary, { room: 'ABCD', now: 1700000000000, startedAt: 1699999000000 });
  assert.equal(rec.v, HISTORY_VERSION);
  assert.equal(rec.id, `1700000000000-ABCD`);
  assert.equal(rec.rounds, 3);
  assert.equal(rec.result.victory, true);
  assert.equal(rec.result.reason, 'cleared');
  assert.equal(rec.players.length, 1);
  assert.equal(rec.players[0].lp, 7);
  assert.equal(rec.battles.length, 2, 'a field with neither f.spec nor a battle opts is skipped');
  assert.equal(rec.battles[0].spec.battleId, 'b.3.1');
  assert.equal(rec.battles[0].round, 3);
  assert.deepEqual(rec.battles[1].result, { killed: 4, total: 4 }, 'a server-run field takes its battle result');
  assert.equal(rec.replayable, true);
});

test('buildMatchRecord: a match without battles is not replayable, and still recorded', () => {
  const m = fakeMatch();
  m.fields = [];
  const rec = buildMatchRecord(m, { victory: false, reason: 'eliminated', roundsPassed: 2 }, { room: 'ZZZZ', now: 5 });
  assert.equal(rec.battles.length, 0);
  assert.equal(rec.replayable, false);
  assert.equal(rec.result.reason, 'eliminated');
});

test('summarize: the list entry has no specs', () => {
  const rec = buildMatchRecord(fakeMatch(), summary, { room: 'ABCD', now: 7 });
  const s = summarize(rec);
  assert.equal(s.battles, 2);
  assert.equal(JSON.stringify(s).includes('battleId'), false, 'no battle payload leaks into the index');
  assert.equal(s.result.victory, true);
});

test('the store: record, list, load; the index survives a reopen', () => {
  const dir = tmp();
  const h = createMatchHistory({ dir });
  assert.equal(h.size, 0);
  const a = buildMatchRecord(fakeMatch(), summary, { room: 'AAAA', now: 1000 });
  const b = buildMatchRecord(fakeMatch(), { victory: false }, { room: 'BBBB', now: 2000 });
  assert.equal(h.record(a), a.id);
  assert.equal(h.record(b), b.id);
  assert.deepEqual(h.list().map((e) => e.id), [b.id, a.id], 'newest first');
  assert.equal(h.load(a.id).battles.length, 2);
  assert.equal(h.load('nope'), null);
  assert.equal(h.load('../etc/passwd'), null, 'a path is not an id');
  const reopened = createMatchHistory({ dir });
  assert.deepEqual(reopened.list().map((e) => e.id), [b.id, a.id]);
  assert.equal(reopened.load(b.id).result.victory, false);
});

test('the store: the limit drops the oldest record and its file', () => {
  const dir = tmp();
  const h = createMatchHistory({ dir, limit: 2 });
  const ids = [1, 2, 3].map((n) => buildMatchRecord(fakeMatch(), summary, { room: `R${n}`, now: n * 1000 }).id);
  for (const id of ids) h.record(buildMatchRecord(fakeMatch(), summary, { room: id.split('-')[1], now: Number(id.split('-')[0]) }));
  assert.deepEqual(h.list().map((e) => e.id), [ids[2], ids[1]]);
  assert.equal(fs.existsSync(path.join(dir, `${ids[0]}.json`)), false, 'the pruned file is gone');
  assert.equal(fs.existsSync(path.join(dir, `${ids[2]}.json`)), true);
});

test('the store: a record over the size cap keeps its meta and loses the specs', () => {
  const dir = tmp();
  const h = createMatchHistory({ dir, maxBytes: 512 });
  const rec = buildMatchRecord(fakeMatch(), summary, { room: 'BIG', now: 42 });
  h.record(rec);
  const stored = h.load(rec.id);
  assert.equal(stored.battles.length, 0);
  assert.equal(stored.truncated, true);
  assert.equal(h.list()[0].replayable, false, 'the list says the replay is not available');
});

test('the store: an invalid record is refused, an unreadable file is not', () => {
  const dir = tmp();
  const h = createMatchHistory({ dir });
  assert.equal(h.record({ id: '../x' }), null);
  assert.equal(h.record({ id: 'ok', at: 1 }), 'ok');
  h.record({ id: 'broken', at: 2 });
  fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json');
  assert.equal(h.load('broken'), null);
});

test('SP_HISTORY: off turns it off, anything else is on', () => {
  assert.equal(parseHistoryMode(undefined), 'on');
  assert.equal(parseHistoryMode('1'), 'on');
  assert.equal(parseHistoryMode('off'), 'off');
  assert.equal(parseHistoryMode('0'), 'off');
  assert.equal(parseHistoryMode('whatever'), 'on');
});

// ----------------------------------------------------------------------------------------------------------------
// the lobby's side: a match that ends writes one record (server/lobby.js onMatchEnd)

const servers = [];
const clients = [];
after(async () => {
  for (const c of clients) await c.terminate().catch(() => {});
  for (const s of servers) await s.close();
});

const waitFor = async (fn, ms = 5000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
};

test('a finished match is recorded; SP_HISTORY=off writes nothing', async () => {
  const dir = tmp();
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, history: createMatchHistory({ dir }) });
  servers.push(srv);
  const c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);
  clients.push(c);
  await c.hello('History');
  const ok = (msg) => c.request(msg).then((r) => { assert.equal(r.t, 'ok', `${msg.t}: ${JSON.stringify(r)}`); return r; });
  await ok({ t: 'room.create', mode: 'solo', difficulty: 'FUNNY' });
  await c.waitFor('room.state');
  await ok({ t: 'room.start' });
  const room = await waitFor(() => [...srv.lobby.rooms.values()][0]);
  assert.ok(room && room.match, 'the match runs');
  room.match.finish({ victory: false, reason: 'defeat' });
  const entry = await waitFor(() => srv.history.list()[0]);
  assert.ok(entry, 'the record is in the index');
  assert.equal(entry.room, room.code);
  assert.equal(entry.result.victory, false);
  assert.equal(entry.result.reason, 'defeat');
  const rec = srv.history.load(entry.id);
  assert.equal(rec.v, HISTORY_VERSION);
  assert.ok(Array.isArray(rec.players) && rec.players.some((p) => p.name === 'History'));
  assert.ok(fs.existsSync(path.join(dir, `${entry.id}.json`)));

  // off: a server started with history: null records nothing
  const srv2 = await startServer({ port: 0, host: '127.0.0.1', quiet: true, history: null });
  servers.push(srv2);
  assert.equal(srv2.history, null);
});

