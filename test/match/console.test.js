// test/match/console.test.js — the debug console's server side (DESIGN §21.33).
//
// The five `g.dbg*` intents of server/match/console.js: any chess (pool, pool-empty, banned/hidden, elite, merge by
// grant), any item (incl. the pair merge), 资金 / 盟约层数 / 调度中心等级 outright, the seat guard (NO_CONSOLE — the
// lobby's `console` flag, never the client's word), the limits, and that every console-made state still obeys the engine
// invariants (hand/temp overflow, pool accounting, shop levels). The lobby-side switch (SP_CONSOLE / 'auto' / loopback)
// is tested with it: parseConsoleMode / consoleAllowed — and over real sockets, where a loopback client gets the console
// and a server started with console: 'off' refuses its intents.

import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, DATA } from './harness.js';
import { validateC2S } from '../../shared/protocol.js';
import { parseConsoleMode, consoleAllowed } from '../../server/lobby.js';
import { isLoopbackIp } from '../../server/net.js';
import { startServer } from '../../server/index.js';
import { Match } from '../../server/match/Match.js';
import { FakeBattle } from './fakeBattle.js';
import { TestClient } from '../helpers/wsClient.js';
import { BOND_LAYER_CAP, CONSOLE_LIMITS } from '../../shared/constants.js';

/** Two humans: p_0 with the console, p_1 without. */
function consoleMatch(o = {}) {
  const h = makeMatch({
    mode: 'coop', difficulty: 'NORMAL', seed: 7,
    seats: [
      { seat: 0, playerId: 'p_0', name: 'P0', isBot: false, connected: true, console: true },
      { seat: 1, playerId: 'p_1', name: 'P1', isBot: false, connected: true },
    ],
    ...o,
  });
  h.start();
  h.toPrep(1);
  return h;
}

/** Send one console intent as p_0 (or `who`) and return the reply. */
const dbg = (m, msg, who = 'p_0') => m.handle(who, msg);

describe('debug console: the guard (§21.33)', () => {
  test('a seat without the console gets NO_CONSOLE for every g.dbg* intent — and nothing changes', () => {
    const h = consoleMatch();
    const ps = h.ps('p_1');
    const before = { funds: ps.funds, hand: ps.hand.filter(Boolean).length, level: ps.shop.level, layers: { ...ps.layers } };
    const bondId = h.m.gd.bondIds[0];
    for (const msg of [
      { t: 'g.dbgChess', chessId: [...h.m.pool.entries.keys()][0] },
      { t: 'g.dbgItem', itemId: h.m.gd.shopItemsByTier[1][0] },
      { t: 'g.dbgFunds', funds: 50 },
      { t: 'g.dbgLayers', bondId, layers: 20 },
      { t: 'g.dbgLevel', level: 5 },
    ]) {
      assert.deepEqual(dbg(h.m, msg, 'p_1'), { error: 'NO_CONSOLE' }, msg.t);
    }
    assert.equal(ps.funds, before.funds);
    assert.equal(ps.hand.filter(Boolean).length, before.hand);
    assert.equal(ps.shop.level, before.level);
    assert.deepEqual(ps.layers, before.layers);
    h.invariants();
  });

  test('m.private carries the seat flag (the panel is only offered where the intents are accepted)', () => {
    const h = consoleMatch();
    assert.equal(h.ps('p_0').privateView().console, true);
    assert.equal(h.ps('p_1').privateView().console, false);
  });

  test('a Match built without the flag (tests, tools) has no console at all', () => {
    const h = makeMatch({ mode: 'coop', difficulty: 'NORMAL', humans: 1, bots: 1, seed: 3 });
    h.start();
    h.toPrep(1);
    assert.equal(h.ps('p_0').privateView().console, false);
    assert.deepEqual(h.m.handle('p_0', { t: 'g.dbgFunds', funds: 50 }), { error: 'NO_CONSOLE' });
  });

  test('an eliminated player and a finished match are refused', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    assert.equal(dbg(h.m, { t: 'g.dbgFunds', funds: 30 }).ok, true);
    ps.alive = false;
    assert.deepEqual(dbg(h.m, { t: 'g.dbgFunds', funds: 30 }), { error: 'ELIMINATED' });
    ps.alive = true;
    h.m.ended = true;
    assert.equal(dbg(h.m, { t: 'g.dbgFunds', funds: 30 }).error, 'WRONG_PHASE');
    h.m.ended = false;
    h.invariants();
  });

  test('unknown ids are BAD_TARGET, an unknown type stays BAD_MSG', () => {
    const h = consoleMatch();
    assert.equal(dbg(h.m, { t: 'g.dbgChess', chessId: 'chess_nope' }).error, 'BAD_TARGET');
    assert.equal(dbg(h.m, { t: 'g.dbgItem', itemId: 'item_nope' }).error, 'BAD_TARGET');
    assert.equal(dbg(h.m, { t: 'g.dbgLayers', bondId: 'nopeShip', layers: 1 }).error, 'BAD_TARGET');
    assert.deepEqual(h.m.handle('p_0', { t: 'g.dbgNope' }), { error: 'BAD_MSG' });
    h.invariants();
  });
});

describe('debug console: chess and items (§21.33)', () => {
  test('any chess: a pooled copy takes a pool copy, an out-of-pool one is created holding none', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const base = [...h.m.pool.entries.keys()][0];
    const left = h.m.pool.left(base);
    assert.equal(dbg(h.m, { t: 'g.dbgChess', chessId: base }).ok, true);
    const piece = ps.hand.find((p) => p && p.id === base);
    assert.ok(piece, 'in the hand');
    assert.equal(piece.poolCopies, 1);
    assert.equal(h.m.pool.left(base), left - 1);

    // banned / hidden chess is not in the pool: still granted (an effect grant with the pool empty, pool.js)
    const banned = h.m.bannedChess[0] || Object.values(DATA.chess).find((c) => c.isHidden && !c.isGolden).chessId;
    assert.equal(h.m.pool.has(h.m.gd.baseIdOf(banned)), false, `${banned} is not a pool chess`);
    assert.equal(dbg(h.m, { t: 'g.dbgChess', chessId: banned }).ok, true);
    const odd = ps.hand.find((p) => p && p.id === banned);
    assert.ok(odd, 'granted anyway');
    assert.equal(odd.poolCopies, 0);
    h.invariants();
  });

  test('a granted elite is the elite, and three granted copies merge like any gain', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const base = [...h.m.pool.entries.keys()].find((id) => h.m.gd.goldenIdOf(id));
    const golden = h.m.gd.goldenIdOf(base);
    assert.equal(dbg(h.m, { t: 'g.dbgChess', chessId: golden }).ok, true);
    const elite = ps.hand.find((p) => p && p.id === golden);
    assert.ok(elite, 'the elite sits in the hand');
    assert.equal(elite.poolCopies, h.m.gd.goldenCopies);
    // clear the hand for the merge reading (returning the copies first: the pool accounting must survive the test's own edit)
    ps.returnCopies(elite);
    ps.hand[ps.hand.indexOf(elite)] = null;

    for (let i = 0; i < 3; i++) assert.equal(dbg(h.m, { t: 'g.dbgChess', chessId: base }).ok, true);
    const owned = [...ps.hand, ...ps.temp].filter((p) => p && h.m.gd.baseIdOf(p.id) === base);
    assert.equal(owned.length, 1, 'exactly one piece of that operator');
    assert.equal(owned[0].id, golden, 'the third copy merged into the elite');
    h.invariants();
  });

  test('a full hand AND temp is HAND_FULL (nothing is lost, the pool is not touched)', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const base = [...h.m.pool.entries.keys()][0];
    for (let i = 0; i < ps.hand.length; i++) ps.hand[i] = ps.newPiece('item', h.m.gd.shopItemsByTier[1][0]);
    for (let i = 0; i < ps.temp.length; i++) ps.temp[i] = ps.newPiece('item', h.m.gd.shopItemsByTier[1][0]);
    const left = h.m.pool.left(base);
    assert.deepEqual(dbg(h.m, { t: 'g.dbgChess', chessId: base }), { error: 'HAND_FULL' });
    assert.equal(h.m.pool.left(base), left, 'the copy is returned');
    ps.hand.fill(null);
    ps.temp.fill(null);
    h.invariants();
  });

  test('any item: granted twice, an identical pair merges (upgradeNum 2)', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const id = Object.values(DATA.items).find((it) => !it.isGolden && it.itemType === 'EQUIP' && it.upgradeChessId)?.id;
    assert.ok(id, 'an upgradeable item exists');
    assert.equal(dbg(h.m, { t: 'g.dbgItem', itemId: id }).ok, true);
    assert.ok(ps.hand.some((p) => p && p.id === id), 'the first copy is in the hand');
    assert.equal(dbg(h.m, { t: 'g.dbgItem', itemId: id }).ok, true);
    const goldenId = h.m.gd.item(id).upgradeChessId;
    assert.ok([...ps.hand, ...ps.temp].some((p) => p && p.id === goldenId), 'the pair became the golden item');
    assert.ok(!ps.hand.some((p) => p && p.id === id), 'the pair is gone');
    h.invariants();
  });
});

describe('debug console: 资金, 盟约层数, 调度中心等级 (§21.33)', () => {
  test('funds are set outright, floored at 0, and land in m.private', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    h.sched.advance(200); h.m.flush(true);
    const before = h.lastTo('p_0', 'm.private').funds;
    assert.equal(dbg(h.m, { t: 'g.dbgFunds', funds: 123 }).ok, true);
    assert.equal(ps.funds, 123);
    assert.equal(dbg(h.m, { t: 'g.dbgFunds', funds: -5 }).ok, true);
    assert.equal(ps.funds, 0);
    assert.notEqual(before, undefined);
    h.sched.advance(200); h.m.flush(true);
    assert.equal(h.lastTo('p_0', 'm.private').funds, 0, 'the private view follows');
    h.invariants();
  });

  test('bond layers are set outright (0 forgets, above the cap clamps, the view follows)', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const bondId = h.m.gd.bondIds[0];
    assert.equal(dbg(h.m, { t: 'g.dbgLayers', bondId, layers: 42 }).ok, true);
    assert.equal(ps.layers[bondId], 42);
    assert.equal(ps.bonds[bondId].layers, 42, 'computed');
    h.sched.advance(200); h.m.flush(true);
    const view = h.lastTo('p_0', 'm.private').bonds.find((b) => b.bondId === bondId);
    assert.equal(view.layers, 42);
    assert.equal(dbg(h.m, { t: 'g.dbgLayers', bondId, layers: BOND_LAYER_CAP + 500 }).ok, true);
    assert.equal(ps.layers[bondId], BOND_LAYER_CAP, 'the official cap');
    assert.equal(dbg(h.m, { t: 'g.dbgLayers', bondId, layers: 0 }).ok, true);
    assert.equal(bondId in ps.layers, false, '0 forgets the bond, it leaves no entry');
    assert.equal(ps.bonds[bondId].layers, 0);
    // layers do not activate a bond by themselves (members do): a gain a player has to earn stays earned
    assert.equal(ps.bonds[bondId].active, false);
    h.invariants();
  });

  test('a mode-inactive bond can be set too (it holds layers the mode never reads)', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const off = [...h.m.gd.modeInactiveBonds][0] || h.m.gd.bondIds[0];
    assert.equal(dbg(h.m, { t: 'g.dbgLayers', bondId: off, layers: 7 }).ok, true);
    assert.equal(ps.layers[off], 7);
    h.invariants();
  });

  test('the shop level is set, its slot count follows, and it never leaves the mode range', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    const max = h.m.gd.maxShopLevel;
    assert.equal(dbg(h.m, { t: 'g.dbgLevel', level: max }).ok, true);
    assert.equal(ps.shop.level, max);
    assert.equal(ps.shop.upgradePrice, 0, 'nothing left to buy');
    assert.equal(ps.shop.slots.filter((s) => s && s.kind === 'chess').length, h.m.gd.shopSlots(max).chess);
    assert.deepEqual(dbg(h.m, { t: 'g.dbgLevel', level: max + 1 }), { error: 'BAD_TARGET', detail: `level above ${max}` });
    assert.equal(ps.shop.level, max, 'unchanged');
    assert.equal(dbg(h.m, { t: 'g.dbgLevel', level: 1 }).ok, true);
    assert.equal(ps.shop.level, 1);
    assert.equal(ps.shop.slots.filter((s) => s && s.kind === 'chess').length, h.m.gd.shopSlots(1).chess);
    assert.ok(ps.shop.upgradePrice > 0, 'the price of the current level is back');
    h.invariants();
  });

  test('the level re-roll keeps frozen, unsold slots (their ids survive)', () => {
    const h = consoleMatch();
    const ps = h.ps('p_0');
    ps.shop.frozen = true;
    ps.rollShop({ keepFrozen: false });
    for (const s of ps.shop.slots) if (s) s.frozen = true;
    const frozen = ps.shop.slots.filter((s) => s && s.kind === 'chess' && s.frozen && !s.sold).map((s) => s.id);
    assert.ok(frozen.length > 0);
    assert.equal(dbg(h.m, { t: 'g.dbgLevel', level: 5 }).ok, true);
    const ids = ps.shop.slots.map((s) => (s ? s.id : null));
    for (const id of frozen) assert.ok(ids.includes(id), `${id} survived the level re-roll`);
    h.invariants();
  });
});

describe('debug console: protocol shape and the lobby switch (§21.33)', () => {
  test('the C2S table accepts the five intents and bounds their setters', () => {
    for (const msg of [
      { t: 'g.dbgChess', chessId: 'chess_char_1_01_a' },
      { t: 'g.dbgItem', itemId: 'chess_item_1_01_e_a' },
      { t: 'g.dbgFunds', funds: 0 },
      { t: 'g.dbgFunds', funds: CONSOLE_LIMITS.funds },
      { t: 'g.dbgLayers', bondId: 'yanShip', layers: 999 },
      { t: 'g.dbgLevel', level: 1 },
    ]) assert.equal(validateC2S(msg), null, JSON.stringify(msg));
    assert.equal(validateC2S({ t: 'g.dbgFunds', funds: -1 }), 'bad field funds');
    assert.equal(validateC2S({ t: 'g.dbgFunds', funds: CONSOLE_LIMITS.funds + 1 }), 'bad field funds');
    assert.equal(validateC2S({ t: 'g.dbgLayers', bondId: 'yanShip', layers: CONSOLE_LIMITS.layers + 1 }), 'bad field layers');
    assert.equal(validateC2S({ t: 'g.dbgLayers', bondId: 'yan Ship', layers: 1 }), 'bad field bondId');
    assert.equal(validateC2S({ t: 'g.dbgLevel', level: 0 }), 'bad field level');
    assert.equal(validateC2S({ t: 'g.dbgChess' }), 'bad field chessId');
    assert.equal(validateC2S({ t: 'g.dbgChess', chessId: 'chess_char_1_01_a', extra: 1 }), null, 'unknown fields are ignored');
  });

  test('SP_CONSOLE / the console option: on, off, auto (anything else)', () => {
    assert.equal(parseConsoleMode(undefined), 'auto');
    assert.equal(parseConsoleMode(''), 'auto');
    assert.equal(parseConsoleMode('maybe'), 'auto');
    for (const v of ['1', 'on', 'TRUE', ' yes ', true]) assert.equal(parseConsoleMode(v), 'on', String(v));
    for (const v of ['0', 'off', 'False', 'no', false]) assert.equal(parseConsoleMode(v), 'off', String(v));
  });

  test('consoleAllowed: loopback only under auto, everyone / nobody under on / off', () => {
    for (const ip of ['127.0.0.1', '127.9.9.9', '::1', '::']) assert.ok(isLoopbackIp(ip), ip);
    for (const ip of ['192.168.1.5', '10.0.0.2', '172.16.3.4', '100.64.0.1', '169.254.1.1', '203.0.113.7', 'fe80::1', 'fd00::1', '2001:db8::1', '', '?', null, undefined]) {
      assert.equal(isLoopbackIp(ip), false, String(ip));
    }
    assert.equal(consoleAllowed('on', '203.0.113.7'), true);
    assert.equal(consoleAllowed('off', '127.0.0.1'), false);
    assert.equal(consoleAllowed('auto', '127.0.0.1'), true);
    assert.equal(consoleAllowed('auto', '::1'), true);
    assert.equal(consoleAllowed('auto', '192.168.1.5'), false, 'the same house is not the same machine');
    assert.equal(consoleAllowed('auto', null), false);
  });
});

// ---- over real sockets: the seat flag comes from the connection, never from the client -------------------------------

class FastMatch extends Match {
  constructor(o) { super({ ...o, timerScale: 0.02, BattleClass: FakeBattle, clientCombat: true }); }
}

const servers = [];
const clients = [];

after(async () => {
  for (const c of clients) await c.terminate().catch(() => {});
  for (const s of servers) await s.close();
});

async function serve(opts) {
  const s = await startServer({ port: 0, host: '127.0.0.1', quiet: true, MatchClass: FastMatch, ...opts });
  servers.push(s);
  return s;
}

/** Connect, enter a solo room and reach PREP (a lone human is untimed: info / band are the client's own moves). */
async function soloPrep(srv, name) {
  const c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);
  clients.push(c);
  const w = await c.hello(name);
  const ok = async (msg) => { const r = await c.request(msg); assert.equal(r.t, 'ok', `${msg.t}: ${JSON.stringify(r)}`); };
  await ok({ t: 'room.create', mode: 'solo', difficulty: 'FUNNY' });
  await c.waitFor('room.state');
  await ok({ t: 'room.start' });
  await c.waitFor('m.public', (p) => p.phase === 'INFO_CHECK');
  await ok({ t: 'g.infoReady' });
  await c.waitFor('m.public', (p) => p.phase === 'BAND_DRAFT');
  await ok({ t: 'g.band', bandId: 'band_sarkazb' });
  const priv = await c.waitFor('m.private', (p) => p.phase !== 'LOBBY' && p.shop.slots.length > 0, 10000);
  return { c, welcome: w, priv };
}

describe('debug console over websockets (§21.33)', () => {
  test('a loopback client is granted the console and every op lands in m.private', async () => {
    FakeBattle.reset();
    FakeBattle.script = () => ({ duration: 1 });
    const srv = await serve({}); // console: 'auto' (the default) — the client connects from 127.0.0.1
    const { c, priv } = await soloPrep(srv, 'Console');
    assert.equal(priv.console, true, 'the seat flag reaches the client');

    const funds = await c.request({ t: 'g.dbgFunds', funds: 77 });
    assert.equal(funds.t, 'ok');
    assert.equal((await c.waitFor('m.private', (p) => p.funds === 77)).funds, 77);

    const bondId = [...srv.lobby.rooms.values()][0].match.gd.bondIds[0];
    assert.equal((await c.request({ t: 'g.dbgLayers', bondId, layers: 33 })).t, 'ok');
    const after = await c.waitFor('m.private', (p) => (p.bonds.find((b) => b.bondId === bondId) || {}).layers === 33);
    assert.equal(after.bonds.find((b) => b.bondId === bondId).layers, 33);

    const chessId = [...srv.lobby.rooms.values()][0].match.pool.entries.keys().next().value;
    assert.equal((await c.request({ t: 'g.dbgChess', chessId })).t, 'ok');
    const withPiece = await c.waitFor('m.private', (p) => p.hand.some((x) => x && x.id === chessId));
    assert.ok(withPiece.hand.some((x) => x && x.id === chessId), 'the granted operator is in the hand');
    assert.equal((await c.request({ t: 'g.dbgItem', itemId: 'chess_item_1_01_e_a' })).t, 'ok');

    // the wire validates the setters before the match ever sees them (net.js validateC2S)
    const bad = await c.request({ t: 'g.dbgFunds', funds: CONSOLE_LIMITS.funds + 1 });
    assert.equal(bad.t, 'error');
    assert.equal(bad.code, 'BAD_MSG');
    const unknown = await c.request({ t: 'g.dbgChess', chessId: 'chess_nope' });
    assert.equal(unknown.code, 'BAD_TARGET');
  });

  test('console: off — the client is not offered it, and its intents are refused (NO_CONSOLE)', async () => {
    FakeBattle.reset();
    FakeBattle.script = () => ({ duration: 1 });
    const srv = await serve({ console: 'off' });
    const { c, priv } = await soloPrep(srv, 'NoConsole');
    assert.equal(priv.console, false);
    const r = await c.request({ t: 'g.dbgFunds', funds: 77 });
    assert.equal(r.t, 'error');
    assert.equal(r.code, 'NO_CONSOLE');
    // the lobby never let the flag reach the match: the same intent is a plain refusal, the funds are untouched
    const next = await c.waitFor('m.private', (p) => p.funds !== undefined);
    assert.notEqual(next.funds, 77);
  });
});
