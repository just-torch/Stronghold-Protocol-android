// test/sim/feedback3-swire-s3.test.js — 琳琅诗怀雅 S3 千金一掷 under the official 卫戍协议 rule (0.3.1, maintainer
// 2026-10-17): the toggle never closes by itself, a full purse of 10 neither fires a coin burst nor pushes anyone, and
// ending it — a manual close, a retreat, the battle's end — spends nothing. The old 2026-10-04 cap-triggered close and
// its front-range burst are gone (CHANGELOG 0.3.1 「琳琅诗怀雅三技能改为遵循官方卫戍协议」).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { hasGeneratedData } from '../../server/sim/simdata.js';

const REAL = { skip: !hasGeneratedData() };
const ID = 'chess_char_3_04_a';
const foe = enemyRec({ key: 'e_sw', hp: 1e9, atk: 0, speed: 0, def: 0, res: 0, mass: 1 });

function battle(pos) {
  return makeBattle({
    defs: { enemies: { e_sw: foe } },
    units: [{ chessId: ID, row: 10, col: 5, skillIndex: 2 }],
    enemies: pos ? [{ key: 'e_sw', pos }] : [],
    hooks: ['damaged', 'skillEnd'], autoFinish: false, timeLimit: 30,
  });
}
const arm = (h) => {
  h.step();
  const u = h.unit(ID);
  assert.equal(u.skill.id, 'skchr_swire2_3');
  assert.ok(u.skill.active || u.skill.activate('test', { free: true }));
  return u;
};
/** Damage events the coin burst would have tagged (there is none any more). */
const coinHits = (h) => h.hooksOf('damaged').filter((c) => (c.dmg?.tags || []).includes('swire2Cash'));

test('琳琅诗怀雅 S3: a full purse keeps the skill open and fires no coin burst', REAL, () => {
  const h = battle([10, 6]);
  const u = arm(h);
  u.mem.coins = 9;
  h.run(2);
  assert.equal(u.skill.active, true, '9 coins do not close it');
  assert.equal(u.mem.coins, 9);

  u.mem.coins = 10; // the cap
  h.run(2);
  assert.equal(u.skill.active, true, 'a full purse does not close the toggle');
  assert.equal(u.mem.coins, 10, 'the purse stays full');
  assert.equal(coinHits(h).length, 0, 'no coin burst');
  assert.equal(u.skill.activations, 1, 'no re-cast either');
  assert.equal(h.b.errors.length, 0);
  checkInvariants(h.b);
});

test('琳琅诗怀雅 S3: the coins never push, and ending the skill spends nothing', REAL, () => {
  const h = battle([10, 6]);
  const u = arm(h);
  const e = h.enemies()[0];
  const x0 = e.x;
  u.mem.coins = 10;
  h.run(1);
  assert.ok(Math.abs(e.x - x0) < 1e-6, 'not pushed by the coins');
  assert.equal(coinHits(h).length, 0);

  u.mem.coins = 4;
  assert.doesNotThrow(() => u.skill.end('manual'));
  assert.equal(u.skill.active, false);
  assert.equal(u.mem.coins, 4, 'a manual close keeps the coins');
  assert.equal(coinHits(h).length, 0, 'and hits nobody');
  checkInvariants(h.b);
});

test('琳琅诗怀雅 S3: a kill at the cap does not raise the purse past 10', REAL, () => {
  const h = battle(null);
  const u = arm(h);
  u.mem.coins = 10;
  h.spawn('e_sw', { pos: [10, 6] });
  const weak = h.enemies()[0];
  weak.hp = 1; // a kill pays a coin — the cap holds it at 10
  h.run(3);
  assert.equal(u.mem.coins, 10);
  assert.equal(u.skill.active, true);
  checkInvariants(h.b);
});
