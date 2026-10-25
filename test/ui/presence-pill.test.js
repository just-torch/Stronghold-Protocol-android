// test/ui/presence-pill.test.js — the lobby header's live online count (owner's request 2026-10-25): the server counts
// the humans with an open socket, pushes S2C `presence` when that changes and carries it in every `welcome`; main.js
// keeps it in the store and the lobby renders ui/components.js PresencePill next to the ping pill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { S2C } from '../../shared/protocol.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('the server counts connected sessions and pushes the frame on every change', () => {
  const lobby = read('server/lobby.js');
  assert.match(lobby, /onlineCount\(\) \{/, 'one place computes the count');
  assert.match(lobby, /for \(const s of this\.registry\.all\(\)\) if \(s\.connected\) n\+\+;/, 'a socket-less session is not online');
  assert.match(lobby, /presenceFrame\(\)/);
  assert.match(lobby, /broadcastPresence\(\)/);
  assert.match(lobby, /info\.presence = \{ online: this\.onlineCount\(\) \}/, 'welcome carries it');
  const calls = lobby.match(/this\.broadcastPresence\(\);/g) || [];
  assert.equal(calls.length, 2, 'one call on attach (onHello), one on close (onDisconnect)');
  assert.match(lobby, /if \(online === this\.lastPresence\) return;/, 'only a real change is sent');
  assert.ok(S2C.includes('presence'), 'the frame is part of the S2C list');
});

test('main.js keeps the pushed count in the store, welcome included', () => {
  const main = read('public/js/main.js');
  assert.match(main, /net\.on\('presence'/, 'the push is subscribed');
  assert.match(main, /store\.patch\('presence', \{ online: msg\.online \}\)/, 'and stored');
  assert.match(main, /msg\.presence\?\.online/, 'welcome.presence seeds it before the first push');
  assert.match(read('public/js/store.js'), /presence: \{ online: null \}/, 'the slice starts unknown');
});

test('the lobby renders the pill next to the ping, from the store', () => {
  const lobby = read('public/js/screens/lobby.js');
  assert.match(read('public/js/ui/components.js'), /export function PresencePill\(\{ online, class: cls \}\)/);
  assert.match(lobby, /import \{[^}]*PresencePill[^}]*\} from '\.\.\/ui\/components\.js'/, 'imported');
  assert.match(lobby, /const presenceOnline = useStore\(\(s\) => s\.presence\?\.online \?\? null\);/, 'read from the store');
  const ping = lobby.indexOf('<${PingPill} ms=${conn.ping} online=${online} />');
  const pill = lobby.indexOf('<${PresencePill} online=${presenceOnline} />');
  assert.ok(ping > 0 && pill > ping, 'right after the ping pill');
  assert.ok(pill < lobby.indexOf('<span class="topbar__sep"'), 'inside the top bar');
});

test('the pill has its own styles and both strings are in every pack', () => {
  const css = read('public/css/components.css');
  assert.match(css, /^\.presence \{/m);
  assert.match(css, /^\.presence__icon \{/m);
  for (const lang of ['en', 'ja', 'ko', 'zh-TW']) {
    const pack = JSON.parse(read(`public/i18n/${lang}.json`));
    assert.equal(typeof pack['服务器当前在线人数'], 'string');
    assert.ok(pack['服务器当前在线人数'].length > 0, `${lang}: tooltip translated`);
    assert.ok(pack['在线人数：{n}'].length > 0, `${lang}: aria label translated`);
  }
});
