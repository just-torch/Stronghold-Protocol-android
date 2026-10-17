// 层数奖励 (ui/bondMilestones.js, the owner's report of 2026-10-17): the bond popup's read-only view of
// data/bonds.json layerMilestones — the milestone progress of 维多利亚 (every 25 layers, one hammer), 远见 (10 / 80 /
// 150), 奇迹 (every 100), 迅捷 / 灵巧 / 突袭 (reach 40 / 50) and 投资人 (reach 100), and the inactive-bond note. The
// payout itself is the server's (server/sim/content/bonds/core.js payHammers, one implementation); this suite pins the
// numbers the player sees next to it and that they agree with the data, so a data change cannot silently mislabel the
// popup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { milestoneModel, milestoneLabel } from '../../public/js/ui/bondMilestones.js';
import { DATA } from '../match/harness.js';

const VICTORIA = DATA.bonds.victoriaShip;

test('维多利亚: every 25 layers, 0 → 25 → 30 → 50 → 100 (paid / next / left, one item each)', () => {
  const at = (layers, active = true) => milestoneModel(VICTORIA, layers, active);
  assert.deepEqual(at(0).map((m) => [m.mode, m.step, m.paid, m.next, m.left, m.pending]), [['every', 25, 0, 25, 25, false]]);
  assert.deepEqual(at(24).map((m) => [m.paid, m.next, m.left]), [[0, 25, 1]]);
  assert.deepEqual(at(25).map((m) => [m.paid, m.next, m.left]), [[1, 50, 25]], 'the 25th layer is the first hammer');
  assert.deepEqual(at(30).map((m) => [m.paid, m.next, m.left]), [[1, 50, 20]]);
  assert.deepEqual(at(50).map((m) => [m.paid, m.next, m.left]), [[2, 75, 25]]);
  assert.deepEqual(at(100).map((m) => [m.paid, m.next, m.left]), [[4, 125, 25]]);
  assert.equal(at(25, false)[0].pending, true, 'inactive: reached but owed (paid when the bond lights up)');
  assert.equal(at(24, false)[0].pending, false, 'inactive and unreached: nothing owed yet');
});

test('远见 (10 every, 80 first, 150 first) and 奇迹 (100 every) and 迅捷 (reach 40)', () => {
  const visi = milestoneModel(DATA.bonds.visiShip, 34, true);
  assert.deepEqual(visi.map((m) => [m.mode, m.step, m.paid, m.next, m.left]), [
    ['every', 10, 3, 40, 6], ['first', 80, 0, 80, 46], ['first', 150, 0, 150, 116],
  ]);
  const mira = milestoneModel(DATA.bonds.miraShip, 250, true);
  assert.deepEqual(mira.map((m) => [m.mode, m.step, m.paid, m.next, m.left]), [['every', 100, 2, 300, 50]]);
  const swift = milestoneModel(DATA.bonds.swiftShip, 39, true);
  assert.deepEqual(swift.map((m) => [m.mode, m.step, m.paid, m.left]), [['reach', 40, 0, 1]]);
  assert.deepEqual(milestoneModel(DATA.bonds.swiftShip, 40, true).map((m) => [m.paid, m.left]), [[1, 0]]);
});

test('bonds without milestones show nothing; an unknown effect key is shown as is; labels are stable', () => {
  assert.deepEqual(milestoneModel(DATA.bonds.yanShip, 100), []);
  assert.deepEqual(milestoneModel(null, 10), []);
  assert.deepEqual(milestoneModel({ layerMilestones: [{ layer: 0, mode: 'every', effect: 'x' }] }, 10), [], 'no step, no line');
  assert.equal(milestoneModel({ layerMilestones: [{ layer: 5, mode: 'every', effect: 'bond_layer_unknown' }] }, 10)[0].label, 'bond_layer_unknown');
  assert.equal(milestoneModel(VICTORIA, 10)[0].label, milestoneLabel('bond_layer_added_reward_equip'));
});
