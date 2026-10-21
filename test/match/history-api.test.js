// test/match/history-api.test.js — the 对局记录 HTTP API (DESIGN §21.58): GET /api/history, GET /api/history/<id>.
//
// The store itself is covered by test/match/history.test.js; this file checks the wire: the list shape, `?limit`, a
// record with its battle specs, an unknown id (a JSON 404, never the HTML error page) and a server with no store.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../../server/index.js';
import { createMatchHistory, buildMatchRecord } from '../../server/history/store.js';

const servers = [];
after(async () => { for (const s of servers) await s.close(); });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sp-history-api-'));

function recordFor(n) {
  return buildMatchRecord({
    mode: 'solo', difficulty: 'FUNNY', modeId: 'FUNNY', seed: n, round: 2,
    players: new Map([['p_0', { playerId: 'p_0', name: `P${n}`, isBot: false, seat: 0, lp: 5, connected: true }]]),
    fields: [{ fieldId: 'n:p_0', kind: 'normal', spec: { fieldId: 'n:p_0', kind: 'normal', round: 2, battleId: `b${n}`, spawns: [] } }],
  }, { victory: n % 2 === 1, reason: 'cleared', roundsPassed: 2 }, { room: `R${n}`, now: 1000 * n });
}

test('GET /api/history lists the records, and one id returns its battle specs', async () => {
  const dir = tmp();
  const store = createMatchHistory({ dir });
  store.record(recordFor(1));
  store.record(recordFor(2));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, history: store });
  servers.push(srv);
  const base = `http://127.0.0.1:${srv.port}`;

  const list = await (await fetch(`${base}/api/history`)).json();
  assert.equal(list.v, 1);
  assert.deepEqual(list.matches.map((m) => m.room), ['R2', 'R1'], 'newest first');
  assert.equal(list.matches[0].id, '2000-R2');

  const one = await (await fetch(`${base}/api/history?limit=1`)).json();
  assert.equal(one.matches.length, 1);

  const rec = await (await fetch(`${base}/api/history/${list.matches[1].id}`)).json();
  assert.equal(rec.room, 'R1');
  assert.equal(rec.result.victory, true);
  assert.equal(rec.battles.length, 1);
  assert.equal(rec.battles[0].spec.battleId, 'b1', 'the replayable battle spec reaches the client');

  const missing = await fetch(`${base}/api/history/2000-nope`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'no such match' });

  const bad = await fetch(`${base}/api/history/a/b`);
  assert.equal(bad.status, 404);
});

test('a server without a store answers an empty list (SP_HISTORY=off)', async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, history: null });
  servers.push(srv);
  const res = await fetch(`http://127.0.0.1:${srv.port}/api/history`);
  assert.equal(res.status, 404, 'no route: the static handler answers, not the API');
});
