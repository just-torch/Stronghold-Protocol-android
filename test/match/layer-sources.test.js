// The layer sources that feed 谢拉格 / 灵巧 (and the 变形同构体 path) — the operators and the item the community report
// pointed at ("谢拉格 paired with 灵巧 stacks fewer layers than expected"): 灵知 (谢拉格 + 灵巧, garrison_111 <获得时>
// 自身所属盟约层数+5 无需激活), 锏 (谢拉格 + 卡西米尔 + 迅捷, garrison_65 +8), 溯光星源 (灵巧 + 奥术, garrison_121
// 休整期结束时每花费 3 资金 +2), and 随身身份牌 (chess_item_1_04_e <装备时销毁> 携带者所属盟约层数 +3/+6 无需激活).
// Every grant runs through the real acquisition / equip paths (PlayerState.acquireChess / g.equip), which is what
// dispatches onGain / onEquip — the harness's `give()` inserts a piece silently and would show 0 for all of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, giveItem, DATA, legalTileFor } from './harness.js';

function prep({ mode = 'solo', difficulty = 'HARD', seed = 21 } = {}) {
  const h = makeMatch({ mode, difficulty, humans: 1, seed, fake: false }).start();
  h.toPrep(1);
  const ps = h.ps('p_0');
  for (const p of [...ps.board.values(), ...ps.hand.filter(Boolean), ...ps.temp.filter(Boolean)]) if (p.kind === 'chess') ps.returnCopies(p);
  ps.board.clear(); ps.hand.fill(null); ps.temp.fill(null); ps.offers.length = 0;
  ps.funds = 80; ps.bandId = null;
  ps.recompute();
  return h;
}
const ok = (r) => assert.deepEqual(r, { ok: true });
const L = (ps, id) => ps.layers[id] || 0;
const activate = (ps, ...bonds) => { for (const b of bonds) ps.bondCountBonus[b] = 20; ps.recompute(); };
/** Put `chessId` on the board through the real acquisition + move handlers, return the piece. */
const place = (m, ps, chessId) => {
  const p = ps.acquireChess(chessId, { source: 'test' });
  const at = legalTileFor(m, ps, chessId);
  ok(m.handle('p_0', { t: 'g.move', uid: p.uid, to: { area: 'board', row: at[0], col: at[1] } }));
  return p;
};
const equip = (m, ps, itemId, targetUid) => {
  const it = giveItem(m, ps, itemId);
  ok(m.handle('p_0', { t: 'g.equip', itemUid: it.uid, targetUid }));
  return it;
};

test('灵知 (谢拉格 + 灵巧): <获得时> +5 to BOTH bonds, activation not required', () => {
  const h = prep();
  try {
    const ps = h.ps('p_0');
    assert.deepEqual(DATA.chess.chess_char_4_13_a.bonds, ['kjeragShip', 'skillfulShip']);
    assert.equal(!!(ps.bonds.skillfulShip && ps.bonds.skillfulShip.active), false);
    ps.acquireChess('chess_char_4_13_a', { source: 'test' });
    assert.equal(L(ps, 'kjeragShip'), 5);
    assert.equal(L(ps, 'skillfulShip'), 5);
  } finally { h.m.dispose(); }
});

test('锏 (谢拉格 + 卡西米尔 + 迅捷): <获得时> +8 to every bond it carries (garrison_65)', () => {
  const h = prep();
  try {
    const ps = h.ps('p_0');
    assert.deepEqual(DATA.chess.chess_char_6_19_a.bonds, ['kjeragShip', 'kazimierzShip', 'swiftShip']);
    ps.acquireChess('chess_char_6_19_a', { source: 'test' });
    assert.deepEqual([L(ps, 'kjeragShip'), L(ps, 'kazimierzShip'), L(ps, 'swiftShip')], [8, 8, 8]);
  } finally { h.m.dispose(); }
});

test('溯光星源 (灵巧 + 奥术): <休整期结束时> +2 per 3 funds spent, only while the bond is active (garrison_121)', () => {
  const h = prep();
  try {
    const { m } = h; const ps = h.ps('p_0');
    place(m, ps, 'chess_char_6_16_a');
    ps.round.spent = 10;
    m.dispatch(ps, 'onPrepEnd', { round: 1 });
    assert.deepEqual([L(ps, 'skillfulShip'), L(ps, 'arcaneShip')], [0, 0], 'inactive: 已激活 is required');
    activate(ps, 'skillfulShip', 'arcaneShip');
    m.dispatch(ps, 'onPrepEnd', { round: 1 });
    assert.deepEqual([L(ps, 'skillfulShip'), L(ps, 'arcaneShip')], [6, 6], '10 / 3 = 3 × 2');
  } finally { h.m.dispose(); }
});

test('随身身份牌 on 灵知: +3 to every bond of the carrier, 谢拉格 AND 灵巧 (无需激活盟约)', () => {
  const h = prep();
  try {
    const { m } = h; const ps = h.ps('p_0');
    const p = place(m, ps, 'chess_char_4_13_a');
    const before = { k: L(ps, 'kjeragShip'), s: L(ps, 'skillfulShip') };
    assert.deepEqual(before, { k: 5, s: 5 }, '灵知\'s own 获得时 trait first');
    equip(m, ps, 'chess_item_1_04_e_a', p.uid);
    assert.deepEqual([L(ps, 'kjeragShip'), L(ps, 'skillfulShip')], [before.k + 3, before.s + 3]);
  } finally { h.m.dispose(); }
});

test('随身身份牌 feeds an INACTIVE bond (角峰: 谢拉格 not active at one member) and a 变形同构体-granted one', () => {
  const h = prep();
  try {
    const { m } = h; const ps = h.ps('p_0');
    const p = place(m, ps, 'chess_char_1_02_a');            // 角峰: 谢拉格 only, own trait +2
    assert.equal(!!(ps.bonds.kjeragShip && ps.bonds.kjeragShip.active), false);
    equip(m, ps, 'chess_item_1_04_e_a', p.uid);
    assert.equal(L(ps, 'kjeragShip'), 5, '2 (角峰) + 3 (item)');
    // 变形同构体 + a bond item: the granted bond is the carrier's bond for membership …
    const q = place(m, ps, 'chess_char_2_03_a');            // 崖心: 谢拉格 only
    equip(m, ps, 'chess_item_6_09_e_a', q.uid);             // 变形同构体 (canGiveBond)
    equip(m, ps, 'chess_item_1_01_e_a', q.uid);             // 维式重锤 → 维多利亚 (giveBondId)
    assert.equal(ps.bonds.victoriaShip ? ps.bonds.victoriaShip.count : 0, 1, 'the granted 维多利亚 counts the carrier');
    // … but 0.2.1's official rule (GitHub #263 / PR #264) replaces one of the two equipped items when a third,
    // consume-on-equip item arrives — the replaced one is destroyed BEFORE the new item's effect runs. So the 身份牌
    // here takes the 变形同构体 with it and its +3 lands on 谢拉格 alone (before 0.2.1 this fork let it stack on top
    // of the pair, which the official rule does not allow).
    const k = L(ps, 'kjeragShip'), v = L(ps, 'victoriaShip');
    equip(m, ps, 'chess_item_1_04_e_a', q.uid);
    assert.deepEqual(q.items.map((x) => x.id), ['chess_item_1_01_e_a'], 'the oldest item was replaced');
    assert.deepEqual([L(ps, 'kjeragShip'), L(ps, 'victoriaShip')], [k + 3, v], '谢拉格 +3; the grant left with the 变形同构体');
    assert.equal(ps.bonds.victoriaShip ? ps.bonds.victoriaShip.count : 0, 0, 'and she no longer counts for 维多利亚');
  } finally { h.m.dispose(); }
});
