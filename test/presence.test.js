// test/presence.test.js — the server-wide online count (S2C `presence`, server/lobby.js broadcastPresence).
//
// The count is what the lobby header shows next to the ping (ui/components.js PresencePill): every `welcome` carries
// it (`welcome.presence`), and everybody connected hears about a change — a session that attaches a socket (new or
// resumed) or loses it. A disconnected session keeps its seat through the reconnect window but is not online; a
// socket replaced by the same token in another tab is the same human, so the count does not move at all.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

import { startServer } from '../server/index.js';
import { TestClient } from './helpers/wsClient.js';

let srv;

before(async () => { srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true }); });
after(async () => { await srv?.close(); });

const url = () => `ws://127.0.0.1:${srv.port}/ws`;

/** Connect + hello; keeps the welcome and the ids the tests need. */
async function connect(name, token) {
  const c = await TestClient.connect(url());
  const w = await c.hello(name, token);
  c.id = w.playerId;
  c.token = w.token;
  c.welcome = w;
  return c;
}

test('welcome carries the count; a connect and a disconnect are pushed to the others', async () => {
  const a = await connect('A');
  assert.equal(a.welcome.t, 'welcome');
  assert.equal(a.welcome.presence.online, 1, 'the joining page is already counted');

  const b = await connect('B');
  assert.equal(b.welcome.presence.online, 2);
  assert.equal((await a.waitFor('presence', (m) => m.online === 2)).online, 2, 'A hears about B');

  await b.terminate();
  assert.equal((await a.waitFor('presence', (m) => m.online === 1)).online, 1, 'A hears that B left');

  await a.terminate();
});

test('a resumed session counts again: its seat outlived the socket, its presence did not', async () => {
  const a = await connect('A');
  const b = await connect('B');
  const token = b.token;
  const id = b.id;
  await b.terminate();
  assert.equal((await a.waitFor('presence', (m) => m.online === 1)).online, 1);

  const again = await connect('B', token);
  assert.equal(again.welcome.resumed, true);
  assert.equal(again.id, id, 'same identity');
  assert.equal(again.welcome.presence.online, 2, 'back online');
  assert.equal((await a.waitFor('presence', (m) => m.online === 2)).online, 2);

  await again.terminate();
  await a.terminate();
});

test('a repeated hello on a live socket does not move the count', async () => {
  const a = await connect('A');
  const frames = () => a.log.filter((m) => m.t === 'presence').length;
  const before = frames();
  const again = await a.hello('A renamed');
  assert.equal(again.playerId, a.id);
  await delay(120);
  assert.equal(frames(), before, 'no presence frame for a repeat hello');
  await a.terminate();
});

test('a socket replaced by the same token in another tab leaves the count alone', async () => {
  const a = await connect('A');
  const second = await connect('A', a.token);
  assert.equal(second.id, a.id, 'same identity');
  assert.equal(second.welcome.presence.online, 1, 'still one human');
  await delay(120);
  assert.equal(second.log.filter((m) => m.t === 'presence').length, 0, 'a replacement is not a connect');
  await second.terminate();
});
