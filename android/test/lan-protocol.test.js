// android/test/lan-protocol.test.js — checks for the LAN room beacon.
//
//   node android/test/lan-protocol.test.js
//
// The beacon is what lets two phones that both tapped 「建立主机」 end up in one match, and it is implemented twice:
// once in JavaScript (android/scripts/nodejs-template/lan/, the announcer inside the app's Node runtime) and once
// in Java (android/android/app/src/main/java/io/github/sganggs/strongholdprotocol/lan/LanDiscoveryCore.java, the
// seeker in the WebView's app process). Two implementations of one wire format is exactly the kind of thing that
// drifts silently, and a drift here means phones simply stop seeing each other, with no error anywhere.
//
// So this file does two jobs:
//   * exercises the JavaScript encoding, validation and room extraction directly;
//   * reads the Java source and asserts its constants and its acceptance rules still match this one. That is not a
//     substitute for running the Java code (android/scripts/lan-verify.mjs does that against the real announcer),
//     but it is the check that catches "someone edited one side".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LAN_MAGIC,
  LAN_VERSION,
  HOST_PORT,
  SEEK_PORT,
  MAX_DATAGRAM,
  MAX_ROOMS,
  encodePacket,
  decodePacket,
  encodeRooms,
  decodeRooms,
  herePacket,
  whoPacket,
  newInstanceId,
  hostFromPacket,
  roomListFromLobby,
} from '../scripts/nodejs-template/lan/protocol.mjs';

import { directedBroadcast, broadcastAddresses } from '../scripts/nodejs-template/lan/net.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JAVA_CORE = path.join(
  APP, 'android', 'app', 'src', 'main', 'java',
  'io', 'github', 'sganggs', 'strongholdprotocol', 'lan', 'LanDiscoveryCore.java',
);

const JAVA_ID = '0123456789abcdef';

describe('lan protocol: encoding', () => {
  test('round-trips every field', () => {
    const buf = encodePacket({ sp: LAN_MAGIC, v: LAN_VERSION, t: 'here', id: JAVA_ID, name: 'Pixel 7 的主机', port: 3000 });
    const parsed = decodePacket(buf);
    assert.equal(parsed.sp, LAN_MAGIC);
    assert.equal(parsed.t, 'here');
    assert.equal(parsed.id, JAVA_ID);
    assert.equal(parsed.name, 'Pixel 7 的主机');
    assert.equal(parsed.port, '3000');
  });

  test('a value may contain =, \\, | and even newlines', () => {
    const nasty = 'a=b\\c|d\nnext\rcarriage';
    const parsed = decodePacket(encodePacket({ sp: LAN_MAGIC, v: 1, t: 'who', id: JAVA_ID, name: nasty }));
    assert.equal(parsed.name, nasty, 'a newline in a value must not create a second field');
  });

  test('empty values are dropped rather than encoded as empty lines', () => {
    const parsed = decodePacket(encodePacket({ sp: LAN_MAGIC, v: 1, t: 'who', id: JAVA_ID, name: '' }));
    assert.equal(parsed.name, undefined);
  });

  test('an invalid key is a programming error, not a silent drop', () => {
    assert.throws(() => encodePacket({ 'bad key': 1 }), TypeError);
  });

  test('the real packets carry what the Java side needs', () => {
    const here = decodePacket(herePacket({ id: JAVA_ID, name: 'x', port: 3000, app: '0.1.1', proto: 1, rooms: [], ts: 7 }));
    assert.deepEqual(
      [here.sp, here.v, here.t, here.id, here.port, here.app, here.proto, here.ts],
      [LAN_MAGIC, String(LAN_VERSION), 'here', JAVA_ID, '3000', '0.1.1', '1', '7'],
    );
    const who = decodePacket(whoPacket(JAVA_ID));
    assert.equal(who.t, 'who');
    assert.equal(who.port, undefined);
  });
});

describe('lan protocol: validation', () => {
  const base = { sp: LAN_MAGIC, v: String(LAN_VERSION), t: 'here', id: JAVA_ID };

  const REJECT = [
    ['empty datagram', Buffer.alloc(0)],
    ['oversized datagram', Buffer.alloc(MAX_DATAGRAM + 1, 0x61)],
    ['not our magic', encodePacket({ ...base, sp: 'other' })],
    ['future version', encodePacket({ ...base, v: String(LAN_VERSION + 1) })],
    ['unknown type', encodePacket({ ...base, t: 'hello' })],
    ['missing id', encodePacket({ ...base, id: '' })],
    ['uppercase id', encodePacket({ ...base, id: 'ABCDEF0123456789' })],
    ['short id', encodePacket({ ...base, id: 'abcd' })],
    ['no magic at all', Buffer.from('name=hi\nport=3000\n', 'utf8')],
    ['a line without =', Buffer.from('splan\nsp=splan\n', 'utf8')],
    ['a key that is not [a-z][a-z0-9]*', Buffer.from('SP=splan\nt=here\nid=' + JAVA_ID + '\n', 'utf8')],
    ['leading =', Buffer.from('=x\n', 'utf8')],
  ];

  for (const [name, buf] of REJECT) {
    test(`rejects ${name}`, () => assert.equal(decodePacket(buf), null));
  }

  test('accepts CRLF and a missing trailing newline', () => {
    const crlf = Buffer.from(`sp=${LAN_MAGIC}\r\nv=${LAN_VERSION}\r\nt=who\r\nid=${JAVA_ID}\r\n`, 'utf8');
    assert.equal(decodePacket(crlf).id, JAVA_ID);
    const bare = Buffer.from(`sp=${LAN_MAGIC}\nv=${LAN_VERSION}\nt=who\nid=${JAVA_ID}`, 'utf8');
    assert.equal(decodePacket(bare).id, JAVA_ID);
  });

  test('a truncated multi-byte name cannot forge a field', () => {
    const full = encodePacket({ sp: LAN_MAGIC, v: LAN_VERSION, t: 'here', id: JAVA_ID, name: '主机名字' });
    const truncated = full.subarray(0, full.length - 3); // cuts into the UTF-8 name, before the final newline
    const parsed = decodePacket(truncated);
    // Either it decodes with a replacement character or not at all, but it must never grow a new field.
    assert.ok(parsed === null || (!('id' in parsed) || parsed.id === JAVA_ID));
  });
});

describe('lan protocol: rooms', () => {
  test('round-trips and keeps every field', () => {
    const rooms = [{ code: 'ABCD', mode: 'coop', diff: 'hard', players: 2, bots: 1, max: 4, inMatch: true }];
    const back = decodeRooms(encodeRooms(rooms));
    assert.deepEqual(back, [{ code: 'ABCD', mode: 'coop', diff: 'hard', players: 2, bots: 1, max: 4, inMatch: true }]);
  });

  test('drops malformed entries instead of failing', () => {
    assert.deepEqual(decodeRooms('nope'), []);
    assert.deepEqual(decodeRooms('abcd,coop,hard,1,0,4,0'), [], 'codes are uppercase');
    assert.deepEqual(decodeRooms('ABCD,coop'), [], 'too few fields');
    assert.deepEqual(decodeRooms(''), []);
    assert.deepEqual(decodeRooms(undefined), []);
  });

  test(`caps the list at ${MAX_ROOMS} so one datagram always fits`, () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      code: String.fromCharCode(65 + (i % 26)) + 'BCD', mode: 'coop', diff: 'normal', players: 1, max: 4,
    }));
    assert.equal(decodeRooms(encodeRooms(many)).length, MAX_ROOMS);
    assert.ok(encodeRooms(many).length < 200, 'the whole room list stays small');
  });
});

describe('lan protocol: host records', () => {
  test('a here packet becomes a usable address', () => {
    const host = hostFromPacket(
      decodePacket(herePacket({ id: JAVA_ID, name: 'Pixel 7 的主机', port: 3000, app: '0.1.1', proto: 1, rooms: [] })),
      { address: '192.168.1.23' },
      1234,
    );
    assert.equal(host.address, '192.168.1.23');
    assert.equal(host.port, 3000);
    assert.equal(host.name, 'Pixel 7 的主机');
    assert.equal(host.lastSeen, 1234);
  });

  test('a nonsensical port is rejected', () => {
    const packet = { id: JAVA_ID, port: '99999' };
    assert.equal(hostFromPacket(packet, { address: '10.0.0.5' }, 0), null);
    assert.equal(hostFromPacket({ ...packet, port: '0' }, { address: '10.0.0.5' }, 0), null);
    assert.equal(hostFromPacket({ ...packet, port: '3000' }, null, 0), null);
  });

  test('a hostile name is truncated, not trusted', () => {
    const host = hostFromPacket({ id: JAVA_ID, port: '3000', name: 'x'.repeat(500) }, { address: '10.0.0.5' }, 0);
    assert.equal(host.name.length, 40);
  });
});

describe('lan protocol: room list from the lobby', () => {
  const seat = (over = {}) => ({ seat: 0, playerId: 'p', name: 'n', isBot: false, ready: false, connected: true, left: false, ...over });

  test('counts humans, bots and departed players like the lobby does', () => {
    const lobby = {
      rooms: new Map([
        ['ABCD', {
          code: 'ABCD', mode: 'coop', difficulty: 'hard', match: null,
          seats: [seat(), seat({ isBot: true }), seat({ left: true }), null],
        }],
      ]),
    };
    assert.deepEqual(roomListFromLobby(lobby), [
      { code: 'ABCD', mode: 'coop', diff: 'hard', players: 1, bots: 1, max: 4, inMatch: false },
    ]);
  });

  test('reports a running match', () => {
    const lobby = {
      rooms: new Map([['WXYZ', { code: 'WXYZ', mode: 'solo', difficulty: 'normal', match: {}, seats: [seat(), seat({ isBot: true })] }]]),
    };
    assert.equal(roomListFromLobby(lobby)[0].inMatch, true);
    assert.equal(roomListFromLobby(lobby)[0].max, 2, 'max follows the real seat array');
  });

  test('a changed lobby shape disables room codes instead of throwing', () => {
    assert.deepEqual(roomListFromLobby(null), []);
    assert.deepEqual(roomListFromLobby({}), []);
    assert.deepEqual(roomListFromLobby({ rooms: null }), []);
    assert.deepEqual(roomListFromLobby({ rooms: 42 }), []);
    assert.deepEqual(roomListFromLobby({ rooms: { values: () => { throw new Error('boom'); } } }), []);
    assert.deepEqual(roomListFromLobby({ rooms: new Map([['ABCD', null], ['EFGH', { seats: [] }]]) }), []);
  });
});

describe('lan protocol: broadcast addresses', () => {
  test('computes the subnet-directed broadcast', () => {
    assert.equal(directedBroadcast('192.168.1.23', '255.255.255.0'), '192.168.1.255');
    assert.equal(directedBroadcast('10.128.158.169', '255.255.0.0'), '10.128.255.255');
    assert.equal(directedBroadcast('172.16.5.4', '255.255.255.128'), '172.16.5.127');
  });

  test('refuses addresses that would be useless or wrong', () => {
    assert.equal(directedBroadcast('192.168.1.23', '255.255.255.255'), null, 'a /32 has no broadcast');
    assert.equal(directedBroadcast('192.168.1.23', '0.0.0.0'), null, '0.0.0.0 would be a second limited broadcast');
    assert.equal(directedBroadcast('not-an-ip', '255.255.255.0'), null);
    assert.equal(directedBroadcast('192.168.1.23', undefined), null);
  });

  test('always includes the limited broadcast, and skips internal interfaces', () => {
    const targets = broadcastAddresses({
      lo: [{ family: 'IPv4', address: '127.0.0.1', netmask: '255.0.0.0', internal: true }],
      wifi: [{ family: 'IPv4', address: '192.168.1.23', netmask: '255.255.255.0', internal: false }],
      ipv6: [{ family: 'IPv6', address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', internal: false }],
    });
    assert.deepEqual(targets, ['255.255.255.255', '192.168.1.255']);
  });
});

describe('lan protocol: instance ids', () => {
  test('look like what the Java side generates', () => {
    for (let i = 0; i < 50; i++) assert.match(newInstanceId(), /^[0-9a-f]{16}$/);
  });
});

describe('lan protocol: the Java half agrees', { skip: existsSync(JAVA_CORE) ? false : 'LanDiscoveryCore.java not present' }, () => {
  const java = readFileSync(JAVA_CORE, 'utf8');

  const constant = (name) => {
    const m = new RegExp(`${name}\\s*=\\s*([^;]+);`).exec(java);
    assert.ok(m, `${name} not found in LanDiscoveryCore.java`);
    return m[1].trim().replace(/_/g, '').replace(/L$/, '');
  };

  test('agrees on the magic and the version', () => {
    assert.equal(constant('MAGIC'), `"${LAN_MAGIC}"`);
    assert.equal(constant('VERSION'), String(LAN_VERSION));
  });

  test('agrees on both ports', () => {
    assert.equal(constant('HOST_PORT'), String(HOST_PORT));
    assert.equal(constant('SEEK_PORT'), String(SEEK_PORT));
    // Different ports are the whole reason a phone can seek and announce at the same time.
    assert.notEqual(HOST_PORT, SEEK_PORT);
  });

  test('agrees on the limits', () => {
    assert.equal(constant('MAX_DATAGRAM'), String(MAX_DATAGRAM));
    assert.equal(constant('MAX_ROOMS'), String(MAX_ROOMS));
  });

  test('treats the same packets as valid', () => {
    // The Java decoder is a port of decodePacket; these are the checks that must not be dropped from it.
    for (const needle of ['"here"', '"who"', 'isInstanceId', 'isKey', 'MAGIC.equals', 'VERSION']) {
      assert.ok(java.includes(needle), `the Java decoder lost its ${needle} check`);
    }
    assert.match(java, /c >= 'a' && c <= 'f'/, 'ids are lower-case hex only');
  });

  test('sends a who packet in the same shape protocol.mjs produces', () => {
    const m = /return "sp=" \+ MAGIC \+ "\\nv=" \+ VERSION \+ "\\nt=who\\nid=" \+ selfId/.exec(java);
    assert.ok(m, 'whoPacket() must stay byte-compatible with protocol.mjs whoPacket()');
    const sample = whoPacket(JAVA_ID).toString('utf8');
    const javaSample = `sp=${LAN_MAGIC}\nv=${LAN_VERSION}\nt=who\nid=${JAVA_ID}\n`;
    assert.equal(javaSample, sample);
  });
});
