// 加速维式重锤 (chess_item_3_10_e_a / _b, activity_table act1autochess_equip_acarm044_global_buff; 蒸汽之心
// acarm079): "攻击力+25%；攻击速度+30" (golden item ATK +45 %), refreshed by items/battle.js hammerRefresh every 0,5 s,
// and doubled — "该“维式重锤”装备特殊效果获得强化（效果变为2倍）" — while a 维多利亚 carrier also wears 蒸汽之心
// (chess_item_6_05_e_a, hammerMul 'steam'; 蒸汽之心 itself carries ASPD +35). The milestone that hands the hammer out is
// the bond's (test/content/bonds_core.test.js); this file pins what the item itself does in a battle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';

const close = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);
const HAMMER = 'chess_item_3_10_e_a';
const HAMMER_B = 'chess_item_3_10_e_b';
const STEAM = 'chess_item_6_05_e_a';
const STEAM_ASPD = 35; // 蒸汽之心's own "攻击速度+35" (attr_common_global_buff)

/** Synthetic 维多利亚 operator: 2000 HP, 500 ATK, ASPD 100. */
const op = (id) => chessRec({
  id, profession: 'WARRIOR', bonds: ['victoriaShip'], tier: 1, rangeGrid: [[0, 0], [0, 1]],
  stats: { maxHp: 2000, atk: 500, def: 200, res: 10, aspd: 100, bat: 1, respawnTime: 20, spRecovery: 1, blockCnt: 2 },
  skill: { spCost: 60, duration: 5, initSp: 0 },
});

function carrier(items) {
  const h = makeBattle({
    defs: { chess: { t_op: op('t_op') }, enemies: { e_d: enemyRec({ key: 'e_d', hp: 1e7, speed: 0 }) } },
    units: [{ chessId: 't_op', row: 10, col: 4, items }],
    enemies: [{ key: 'e_d', pos: [10, 9] }], timeLimit: 999, autoFinish: false,
    bonds: items.includes(STEAM) ? { victoriaShip: { count: 3, active: true, tier: 1, layers: 25 } } : {},
  });
  h.step(1);
  return { h, u: h.unit('t_op') };
}

test('加速维式重锤: ASPD +30 and ATK +25 % (golden +45 %), live from the first tick and after a refresh', () => {
  const base = carrier([]);
  const aspd = base.u.s.aspd, atk = base.u.s.atk;
  for (const [item, atkMul] of [[HAMMER, 1.25], [HAMMER_B, 1.45]]) {
    const { h, u } = carrier([item]);
    close(u.s.aspd, aspd + 30, `${item} ASPD`);
    close(u.s.atk, atk * atkMul, `${item} ATK`);
    h.step(60);
    close(u.s.aspd, aspd + 30, `${item} ASPD after 2 s (hammerRefresh)`);
    checkInvariants(h.b);
  }
});

test('加速维式重锤 + 蒸汽之心 (维多利亚 carrier): the special effect is doubled — ASPD +60, plus 蒸汽之心’s own +35', () => {
  const base = carrier([]);
  const { h, u } = carrier([HAMMER, STEAM]);
  close(u.s.aspd, base.u.s.aspd + 60 + STEAM_ASPD, 'ASPD doubled by 蒸汽之心');
  close(u.s.atk, base.u.s.atk * 1.25, 'the hammer’s ATK is not doubled (only the special effect is)');
  h.step(60);
  close(u.s.aspd, base.u.s.aspd + 60 + STEAM_ASPD, 'still doubled after a refresh');
  checkInvariants(h.b);
});

test('the hammer’s state ends with its carrier: a knocked-out carrier takes no stale ASPD into the next deployment', () => {
  const { h, u } = carrier([HAMMER]);
  close(u.s.aspd, 130, 'ASPD while carrying');
  h.b.kill(u, null);
  h.step(30);
  assert.equal(u.alive, false);
  checkInvariants(h.b);
});
