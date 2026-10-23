// test/ui/settings-room-seats.test.js — 人数上限 lives in 设置 (owner's request 2026-10-23): the host changes the co-op
// room's seat cap in the settings dialog (ui/settings.js RoomSeats → room.setCapacity), and the lobby / room screens no
// longer carry a picker of their own (the lobby's extra row is what pushed 创建同盟 off a 640×360 screen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('the settings dialog owns the seat cap: host-only row, room.setCapacity on click', () => {
  const src = read('public/js/ui/settings.js');
  assert.match(src, /function RoomSeats\(\)/, 'the section exists');
  assert.match(src, /room\.hostId !== me\.playerId/, 'only the host of a co-op room sees it');
  assert.match(src, /room\.mode !== 'coop' \|\| room\.inMatch/, 'never outside a co-op room or after the start');
  assert.match(src, /net\.request\('room\.setCapacity', \{ capacity: n \}\)/, 'a click sends room.setCapacity');
  assert.match(src, /data-testid="room-capacity"/, 'the row is testable');
  assert.ok(src.indexOf('<${RoomSeats} />') > src.indexOf('<div class="set-list">'), 'rendered inside the settings list');
});

test('neither the lobby nor the room screen keeps its own capacity picker', () => {
  const lobby = read('public/js/screens/lobby.js');
  assert.doesNotMatch(lobby, /create-capacity|create-cap__|pickCapacity/, 'no create-screen picker');
  // the create request carries no capacity field (rooms start at the server's DEFAULT_SEATS)
  const create = lobby.slice(lobby.indexOf(`net.request('room.create'`), lobby.indexOf(`net.request('room.create'`) + 300);
  assert.doesNotMatch(create, /capacity/, 'room.create carries no capacity any more');
  const room = read('public/js/screens/room.js');
  assert.doesNotMatch(room, /CapacityControl|capctl|room\.setCapacity/, 'no room-header stepper');
  assert.doesNotMatch(read('public/css/screens/lobby.css'), /\.create-cap/, 'its styles are gone');
  assert.doesNotMatch(read('public/css/screens/room.css'), /\.capctl/, 'its styles are gone');
});

test('the seven seat numbers sit in one row (the default .8rem buttons would wrap)', () => {
  const css = read('public/css/screens/game.css');
  const block = css.slice(css.indexOf('.set-seg.set-seats'));
  assert.match(block.slice(0, 300), /flex-wrap: nowrap/);
  assert.match(block.slice(0, 300), /min-width: \.38rem/);
  assert.match(read('public/js/ui/settings.js'), /class="set-seg set-seats"/);
});
