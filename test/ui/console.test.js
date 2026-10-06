// test/ui/console.test.js — the debug console panel's model (DESIGN §21.33, public/js/ui/console.js).
//
// The pure half of the panel, against the real data files: the 干员 / 装备 / 盟约 row builders and their filters
// (hidden chess, non-shop items, the mode's 本局禁用 bonds, search terms, tiers), the steppers (clamping to the server's
// limits) and the command parser — every command it produces must be a message the protocol accepts (validateC2S), so a
// typed line can never be refused for its shape.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildIndex } from '../../public/js/data.js';
import { validateC2S } from '../../shared/protocol.js';
import { BOND_LAYER_CAP, CONSOLE_LIMITS } from '../../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const model = await import(pathToFileURL(path.join(ROOT, 'public/js/ui/console.js')).href);

const read = (name) => JSON.parse(readFileSync(path.join(ROOT, 'data', `${name}.json`), 'utf8'));
const chessJson = read('chess');
const itemsJson = read('items');
const bondsJson = read('bonds');
const config = read('config');

/** The client's data lookups over the real files (data.js indexes them the same way). */
const gd = {
  list: (name) => [...(name === 'chess' ? buildIndex('chess', chessJson) : name === 'items' ? buildIndex('items', itemsJson) : buildIndex('bonds', bondsJson)).values()],
  bond: (id) => buildIndex('bonds', bondsJson).get(id) || null,
  chess: (id) => buildIndex('chess', chessJson).get(id) || null,
  item: (id) => buildIndex('items', itemsJson).get(id) || null,
};
const mode = config.modes.mode_multi_normal;
const pub = { modeId: 'mode_multi_normal' };
/** A private view with a couple of state entries (the rows read it). */
const priv = {
  funds: 7, deployCount: 5, deployCap: 8, hand: [1, 2, null], temp: [], shop: { level: 3, maxLevel: 6 },
  bonds: [{ bondId: 'yanShip', count: 4, active: true, tier: 1, layers: 12, thresholds: [3, 6, 9] }],
};
const ids = (rows) => rows.map((r) => r.id);

describe('console: 干员 rows (§21.33)', () => {
  test('a row carries the name, id, elite id, tier, profession, bond names and a search haystack', () => {
    const rec = gd.chess('chess_char_1_01_a');
    const row = model.chessRow(rec, gd.bond);
    assert.equal(row.id, 'chess_char_1_01_a');
    assert.equal(row.goldenId, 'chess_char_1_01_b');
    assert.equal(row.name, rec.name);
    assert.equal(row.tier, 1);
    assert.equal(row.rare, false);
    assert.deepEqual(row.bonds.map((b) => b.name), rec.bonds.map((b) => gd.bond(b).name));
    for (const term of [rec.name, rec.chessId, rec.appellation]) assert.ok(row.hay.includes(String(term).toLowerCase()), term);
    assert.equal(model.chessRow(null).name, '');
    assert.equal(model.chessRow(null).tier, 0);
  });

  test('the default list is the visible, non-elite chess; 隐藏 / 内置 needs the toggle', () => {
    const rows = model.consoleRows('chess', { gd, priv, pub });
    const visible = gd.list('chess').filter((c) => c.visible && !c.isGolden && !c.isHidden && !c.isDiy);
    assert.equal(rows.length, visible.length);
    assert.ok(rows.every((r) => !r.rare));
    const all = model.consoleRows('chess', { gd, priv, pub, extra: true });
    assert.equal(all.length, gd.list('chess').filter((c) => !c.isGolden && (c.visible || c.isHidden || c.isDiy)).length);
    assert.ok(all.some((r) => r.rare), 'the odd ones are marked');
    assert.ok(rows.every((r) => !r.id.endsWith('_b')), 'never an elite record of its own');
  });

  test('sorted by tier then the data order, and the tier filter is exact', () => {
    const rows = model.consoleRows('chess', { gd, priv, pub });
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].tier <= rows[i].tier, `tier order at ${i}`);
    for (const t of [1, 3, 5]) {
      const some = model.consoleRows('chess', { gd, priv, pub, tier: t });
      assert.ok(some.length > 0);
      assert.ok(some.every((r) => r.tier === t));
    }
  });

  test('search: name, 代号, profession, and a bond name all match; every term must hit', () => {
    const silver = model.consoleRows('chess', { gd, priv, pub, query: '银灰' });
    assert.ok(silver.length >= 1 && silver.every((r) => r.hay.includes('银灰')));
    const byId = model.consoleRows('chess', { gd, priv, pub, query: 'chess_char_1_01_a' });
    assert.deepEqual(ids(byId), ['chess_char_1_01_a']);
    const byBond = model.consoleRows('chess', { gd, priv, pub, query: gd.bond('yanShip').name });
    assert.ok(byBond.length > 3, 'every 炎 operator');
    assert.ok(byBond.every((r) => r.bonds.some((b) => b.id === 'yanShip')));
    assert.deepEqual(model.consoleRows('chess', { gd, priv, pub, query: 'chess_char_1_01_a 银灰' }), [], 'terms are ANDed');
    assert.deepEqual(model.consoleRows('chess', { gd, priv, pub, query: '没有这个干员' }), []);
  });
});

describe('console: 装备 rows (§21.33)', () => {
  test('the default list is the shop items; 非商店 / 奇术 needs the toggle and is marked', () => {
    const rows = model.consoleRows('items', { gd, priv, pub });
    const shop = gd.list('items').filter((i) => !i.isGolden && !i.hideInShop && !i.shopExcluded);
    assert.equal(rows.length, shop.length);
    assert.ok(rows.every((r) => !r.rare));
    const all = model.consoleRows('items', { gd, priv, pub, extra: true });
    assert.equal(all.length, gd.list('items').filter((i) => !i.isGolden).length);
    assert.ok(all.some((r) => r.rare));
    assert.ok(all.some((r) => r.magic), 'the 奇术 arts are listed too');
  });

  test('a row carries the tier, the description and a search over 效果 text', () => {
    const rec = gd.list('items').find((i) => !i.isGolden && i.desc);
    const row = model.itemRow(rec);
    assert.equal(row.id, rec.id);
    assert.equal(row.tier, rec.tier);
    assert.equal(row.desc, rec.desc);
    const hits = model.consoleRows('items', { gd, priv, pub, query: rec.name });
    assert.ok(hits.some((r) => r.id === rec.id));
    const byId = model.consoleRows('items', { gd, priv, pub, query: rec.id });
    assert.deepEqual(ids(byId), [rec.id]);
  });
});

describe('console: 盟约 rows (§21.33)', () => {
  test('a row merges the data record with the player state; a missing entry is 0 / 未激活', () => {
    const row = model.bondRow(gd.bond('yanShip'), priv);
    assert.equal(row.id, 'yanShip');
    assert.equal(row.layers, 12);
    assert.equal(row.count, 4);
    assert.equal(row.active, true);
    assert.deepEqual(row.thresholds, [3, 6, 9]);
    const other = model.bondRow(gd.bond('sargonShip'), priv);
    assert.equal(other.layers, 0);
    assert.equal(other.active, false);
    assert.equal(other.count, 0);
  });

  test('the mode-inactive bonds are the odd ones (本局禁用), the rest is the mode\'s set', () => {
    const rows = model.consoleRows('bonds', { gd, priv, pub, mode });
    const off = new Set(mode.inactiveBondIds);
    assert.equal(rows.length, gd.list('bonds').length - off.size);
    assert.ok(rows.every((r) => !off.has(r.id)));
    const all = model.consoleRows('bonds', { gd, priv, pub, mode, extra: true });
    assert.equal(all.length, gd.list('bonds').length);
    for (const id of off) assert.ok(all.find((r) => r.id === id)?.off, `${id} is tagged 本局禁用`);
    assert.equal(model.consoleRows('bonds', { gd, priv, pub, mode, query: gd.bond('yanShip').name }).length, 1);
  });

  test('the data order (bondOrder, then identifier) — never re-sorted by layers, so a row cannot jump', () => {
    const rows = model.consoleRows('bonds', { gd, priv, pub, mode });
    assert.equal(rows.find((r) => r.id === 'yanShip').layers, 12, 'the entered state is carried per row');
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      assert.ok((a.rec.bondOrder ?? 0) < (b.rec.bondOrder ?? 0)
        || ((a.rec.bondOrder ?? 0) === (b.rec.bondOrder ?? 0) && (a.rec.identifier ?? 0) <= (b.rec.identifier ?? 0)),
      `${a.id} before ${b.id}`);
    }
  });
});

describe('console: steppers and status (§21.33)', () => {
  test('funds clamp into what the server accepts', () => {
    assert.equal(model.clampFunds(12), 12);
    assert.equal(model.clampFunds(-3), 0);
    assert.equal(model.clampFunds(CONSOLE_LIMITS.funds + 500), CONSOLE_LIMITS.funds);
    assert.equal(model.clampFunds('nope'), 0);
    assert.equal(model.fundsStep(8, 20), 28);
    assert.equal(model.fundsStep(8, -20), 0);
    assert.equal(model.fundsStep(CONSOLE_LIMITS.funds, 20), CONSOLE_LIMITS.funds);
    assert.equal(validateC2S({ t: 'g.dbgFunds', funds: model.fundsStep(CONSOLE_LIMITS.funds, 20) }), null);
  });

  test('layers clamp at 0 and the official 999 cap', () => {
    assert.equal(model.clampLayers(42), 42);
    assert.equal(model.clampLayers(-1), 0);
    assert.equal(model.clampLayers(BOND_LAYER_CAP + 1), BOND_LAYER_CAP);
    assert.equal(model.layerStep(995, 10), BOND_LAYER_CAP);
    assert.equal(model.layerStep(3, -10), 0);
    assert.equal(validateC2S({ t: 'g.dbgLayers', bondId: 'yanShip', layers: model.layerStep(995, 10) }), null);
  });

  test('grantId picks the elite only when asked and available', () => {
    const rec = gd.chess('chess_char_1_01_a');
    assert.equal(model.grantId(rec), 'chess_char_1_01_a');
    assert.equal(model.grantId(rec, true), 'chess_char_1_01_b');
    assert.equal(model.grantId({ chessId: 'x' }, true), 'x', 'no elite → the normal one');
    assert.equal(model.grantId(null), null);
  });

  test('the status line reads the private view', () => {
    assert.equal(model.consoleStatus(priv), '资金 7 · 等级 3 · 整备区 2/10 · 临时 0/5 · 场上 5/8');
    assert.match(model.consoleStatus(null), /资金 0 · 等级 1/);
  });

  test('the panel keeps a few log lines and offers four tabs / the steps it uses', () => {
    assert.deepEqual(model.CONSOLE_TABS.map((t) => t.id), ['chess', 'items', 'res', 'bonds']);
    assert.equal(model.LOG_LINES, 6, 'the help prints six lines and they all stay in the log');
    assert.deepEqual([...model.FUNDS_STEPS], [1, 5, 20]);
    assert.deepEqual([...model.LAYER_STEPS], [1, 10]);
    assert.deepEqual([...model.CONSOLE_TIERS], [1, 2, 3, 4, 5, 6]);
    assert.equal(model.CONSOLE_KEY, '`');
  });
});

describe('console: the command parser (§21.33)', () => {
  const parse = (text) => model.parseConsoleCommand(text, { gd, priv });
  const silver = gd.list('chess').find((c) => c.name === '银灰' && c.visible && !c.isGolden);
  const item = gd.list('items').find((i) => !i.isGolden && i.desc);

  test('resolveRecord: exact id, exact name, the unique partial, then the ambiguity', () => {
    const list = [{ id: 'a', name: '甲' }, { id: 'b', name: '甲乙' }, { id: 'c', name: '丙' }];
    assert.equal(model.resolveRecord(list, 'a').rec.id, 'a');
    assert.equal(model.resolveRecord(list, ' 甲 ').rec.id, 'a');
    assert.equal(model.resolveRecord(list, 'b').rec.id, 'b');
    assert.equal(model.resolveRecord(list, '乙').rec.id, 'b', 'the unique partial');
    assert.deepEqual(model.resolveRecord(list, '甲').rec.id, 'a', 'an exact name beats the longer partial');
    const amb = model.resolveRecord(list, '甲').error;
    assert.equal(amb, undefined);
    const many = model.resolveRecord([{ id: 'a', name: '甲乙' }, { id: 'b', name: '甲丙' }], '甲');
    assert.equal(many.error, 'ambiguous');
    assert.deepEqual(many.options, ['甲乙', '甲丙']);
    assert.equal(model.resolveRecord(list, 'zz').error, 'none');
    assert.equal(model.resolveRecord(list, '').error, 'none');
  });

  test('numberArg: absolute and ± steps only', () => {
    assert.equal(model.numberArg('20', 5), 20);
    assert.equal(model.numberArg('+20', 5), 25);
    assert.equal(model.numberArg('-3', 5), 2);
    assert.equal(model.numberArg('  +2  ', 0), 2);
    for (const bad of ['', 'x', '1.5', '20层', null, undefined]) assert.equal(model.numberArg(bad, 5), null, String(bad));
  });

  test('chess: by name, by id, 精锐, and the failures', () => {
    const r = parse(`chess ${silver.name}`);
    assert.equal(r.t, 'g.dbgChess');
    assert.equal(r.fields.chessId, silver.chessId);
    assert.match(r.echo, /获得干员 银灰/);
    assert.equal(validateC2S({ t: r.t, ...r.fields }), null);
    assert.equal(parse(`chess ${silver.chessId}`).fields.chessId, silver.chessId);
    assert.equal(parse(`chess ${silver.name} 精锐`).fields.chessId, silver.goldenId);
    assert.equal(parse(`chess ${silver.name} elite`).fields.chessId, silver.goldenId);
    assert.equal(parse('chess 不存在的干员').error, '没有干员「不存在的干员」');
    assert.match(parse('chess').error, /没有干员/);
    assert.match(parse('干员 银灰').echo, /银灰/, 'the Chinese verb works too');
  });

  test('item: by name, by effect text, and the failures', () => {
    const r = parse(`item ${item.name}`);
    assert.equal(r.t, 'g.dbgItem');
    assert.equal(r.fields.itemId, item.id);
    assert.equal(validateC2S({ t: r.t, ...r.fields }), null);
    assert.equal(parse(`equip ${item.id}`).fields.itemId, item.id);
    assert.equal(parse('item 不存在').error, '没有装备「不存在」');
  });

  test('funds / level: absolute, relative, clamped, and bad arguments', () => {
    assert.deepEqual(parse('funds 30').fields, { funds: 30 });
    assert.deepEqual(parse('funds +20').fields, { funds: 27 });
    assert.deepEqual(parse('funds -100').fields, { funds: 0 });
    assert.deepEqual(parse('funds 99999').fields, { funds: CONSOLE_LIMITS.funds });
    assert.deepEqual(parse('资金 3').fields, { funds: 3 });
    assert.match(parse('funds').error, /资金需要一个数字/);
    assert.deepEqual(parse('level 5').fields, { level: 5 });
    assert.deepEqual(parse('level +1').fields, { level: 4 });
    assert.deepEqual(parse('level 99').fields, { level: 6 }, 'the mode max');
    assert.deepEqual(parse('level -99').fields, { level: 1 });
    assert.match(parse('level x').error, /等级需要一个数字/);
  });

  test('bond: by name, absolute and ± against the current layers, capped', () => {
    const yan = gd.bond('yanShip');
    const r = parse(`bond ${yan.name} 50`);
    assert.equal(r.t, 'g.dbgLayers');
    assert.deepEqual(r.fields, { bondId: 'yanShip', layers: 50 });
    assert.match(r.echo, /炎 层数 → 50/);
    assert.equal(validateC2S({ t: r.t, ...r.fields }), null);
    assert.deepEqual(parse(`bond ${yan.name} +10`).fields, { bondId: 'yanShip', layers: 22 }, 'priv has 12');
    assert.deepEqual(parse(`bond ${yan.name} -100`).fields, { bondId: 'yanShip', layers: 0 });
    assert.deepEqual(parse('bond 萨尔贡 +9999').fields, { bondId: 'sargonShip', layers: BOND_LAYER_CAP });
    assert.deepEqual(parse('bond yanShip 7').fields, { bondId: 'yanShip', layers: 7 }, 'the id works too');
    assert.match(parse('bond 不存在的盟约 3').error, /没有盟约/);
    assert.match(parse('bond 炎').error, /盟约需要/);
    assert.match(parse('bond 炎 很多').error, /不是层数/);
  });

  test('help, empty and unknown lines', () => {
    for (const h of ['help', '?', '帮助']) assert.equal(parse(h).help, true);
    assert.match(parse('').error, /输入一条命令/);
    assert.match(parse('   ').error, /输入一条命令/);
    assert.equal(parse('nope 1').error, '未知命令「nope」（help 看说明）');
    assert.ok(model.COMMAND_HELP.length >= 6);
    for (const line of model.COMMAND_HELP) assert.match(line, /·/, line);
  });

  test('every command the help lists parses into a message the protocol accepts', () => {
    const lines = [
      `chess ${silver.name}`, `chess ${silver.chessId} 精锐`, `item ${item.name}`, `item ${item.id}`,
      'funds 40', 'funds +5', 'bond yanShip 120', 'bond 炎 +5', 'level 6', 'level -1',
    ];
    for (const line of lines) {
      const r = parse(line);
      assert.ok(r.t, `${line}: ${JSON.stringify(r)}`);
      assert.equal(validateC2S({ t: r.t, ...r.fields }), null, `${line} → ${JSON.stringify(r.fields)}`);
      assert.ok(r.echo.length > 0, line);
    }
  });
});
