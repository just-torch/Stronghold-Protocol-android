// test/ui/history-client.test.js — the 对局记录 client (ui/historyClient.js, DESIGN §21.58).
//
// The wire behaviour is the server's (test/match/history-api.test.js); this pins what the page makes of it: a 404 means
// the feature is off (not an error), a record without battles is refused, the list is cached for a few seconds, a record
// is fetched once per page load, and a failed fetch never throws into the UI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadServerHistory, loadServerRecord, clearHistoryCache } from '../../public/js/ui/historyClient.js';

const realFetch = globalThis.fetch;
/** A fetch stub: `routes` maps a URL predicate to `{ status, body }` (built once per call). */
function stub(routes) {
  globalThis.fetch = async (url) => {
    for (const [match, make] of routes) {
      if (match(url)) {
        const res = typeof make === 'function' ? make() : make;
        if (res instanceof Error) throw res;
        const status = res.status;
        return { ok: status >= 200 && status < 300, status, json: async () => res.body };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}
const restore = () => { globalThis.fetch = realFetch; clearHistoryCache(); };

test('the list: ok / off (404) / error', async () => {
  try {
    stub([[(u) => u.startsWith('/api/history?'), { status: 200, body: { v: 1, matches: [{ id: '1-R', room: 'R' }] } }]]);
    const ok = await loadServerHistory();
    assert.equal(ok.status, 'ok');
    assert.equal(ok.matches.length, 1);

    stub([[(u) => u.startsWith('/api/history?'), { status: 404, body: {} }]]);
    clearHistoryCache();
    const off = await loadServerHistory();
    assert.deepEqual([off.status, off.matches.length], ['off', 0], 'no route = the feature is off');

    stub([[(u) => u.startsWith('/api/history?'), new Error('boom')]]);
    clearHistoryCache();
    const bad = await loadServerHistory();
    assert.equal(bad.status, 'error');
    assert.match(bad.error, /boom/);
  } finally { restore(); }
});

test('the list is cached for a few seconds, `fresh` bypasses it', async () => {
  let calls = 0;
  try {
    stub([[() => true, () => { calls++; return { status: 200, body: { v: 1, matches: [] } }; }]]);
    await loadServerHistory();
    await loadServerHistory();
    assert.equal(calls, 1, 'second call within the window: cached');
    await loadServerHistory({ fresh: true });
    assert.equal(calls, 2);
  } finally { restore(); }
});

test('one record: ok, missing battles, a bad id', async () => {
  try {
    stub([
      [(u) => u === '/api/history/7-ABC', { status: 200, body: { id: '7-ABC', battles: [{ fieldId: 'n:p_0', spec: { seed: 1 } }], app: '0.3.1' } }],
      [(u) => u === '/api/history/8-BAD', { status: 200, body: { id: '8-BAD' } }],
      [(u) => u === '/api/history/9-GONE', { status: 404, body: {} }],
    ]);
    const ok = await loadServerRecord('7-ABC');
    assert.equal(ok.ok, true);
    assert.equal(ok.record.battles[0].spec.seed, 1);

    const bad = await loadServerRecord('8-BAD');
    assert.equal(bad.ok, false, 'a body without battles is not a record');

    const gone = await loadServerRecord('9-GONE');
    assert.equal(gone.ok, false);

    assert.equal((await loadServerRecord('')).ok, false, 'no id, no fetch');
  } finally { restore(); }
});

test('a record is fetched once; a failed fetch is not cached as a record', async () => {
  let calls = 0;
  try {
    stub([[() => true, () => { calls++; return calls === 1 ? { status: 500, body: {} } : { status: 200, body: { id: 'x', battles: [] } }; }]]);
    const first = await loadServerRecord('x');
    assert.equal(first.ok, false, 'the first answer is a 500');
    const second = await loadServerRecord('x');
    assert.equal(second.ok, true, 'a failure is retried');
    await loadServerRecord('x');
    assert.equal(calls, 2, 'then cached');
  } finally { restore(); }
});
