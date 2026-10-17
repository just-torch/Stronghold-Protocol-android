// 作战统计's live ranking (ui/combatMetrics.js, the owner's request of 2026-10-17): the four sortable metrics
// (伤害 / DPS / 治疗 / HPS), the stable tie-breaking, and the owner chip of a row that is not the viewer's own.
// The panel itself needs a DOM; these two helpers are what the panel's numbers and labels come down to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankRows, ownerLabelOf } from '../../public/js/ui/combatMetrics.js';

const row = (name, damage, dps, healing, hps, ownerId = 'me') => ({ key: `${ownerId}|${name}`, ownerId, name, damage, dps, healing, hps, kind: 'op', defId: name, uid: 1, types: {} });

test('rankRows: the chosen metric decides the order, ranks 1..n, every value kept', () => {
  const rows = [row('A', 900, 90, 0, 0), row('B', 500, 250, 0, 0), row('C', 700, 10, 40, 4), row('D', 0, 0, 800, 60)];
  assert.deepEqual(rankRows(rows, 'damage').map((r) => r.name), ['A', 'C', 'B', 'D']);
  assert.deepEqual(rankRows(rows, 'dps').map((r) => r.name), ['B', 'A', 'C', 'D']);
  assert.deepEqual(rankRows(rows, 'healing').map((r) => r.name), ['D', 'C', 'A', 'B']);
  assert.deepEqual(rankRows(rows, 'hps').map((r) => r.name), ['D', 'C', 'A', 'B'], 'A and B tie at 0 HPS: damage breaks it');
  assert.deepEqual(rankRows(rows, 'dps')[0], rows[1], 'the row object keeps all four values');
  assert.deepEqual(rows.map((r) => r.name), ['A', 'B', 'C', 'D'], 'the input is not reordered');
});

test('rankRows: ties fall back to damage, then healing, then the key; an unknown metric is damage', () => {
  const rows = [row('b', 100, 5, 0, 0), row('a', 100, 5, 0, 0), row('c', 100, 5, 10, 0)];
  assert.deepEqual(rankRows(rows, 'dps').map((r) => r.name), ['c', 'a', 'b']);
  assert.deepEqual(rankRows(rows, 'nonsense').map((r) => r.name), ['c', 'a', 'b']);
  assert.deepEqual(rankRows([], 'damage'), []);
  assert.deepEqual(rankRows(null, 'damage'), []);
  // a missing / broken value counts as 0, never NaN ordering
  assert.deepEqual(rankRows([{ ...row('x', 10, 1, 0, 0), dps: undefined }, row('y', 0, 2, 0, 0)], 'dps').map((r) => r.name), ['y', 'x']);
});

test('ownerLabelOf: the viewer has no chip, a teammate shows its name, an unknown one 「队友」', () => {
  const names = new Map([['p_1', 'P1'], ['p_2', '']]);
  assert.equal(ownerLabelOf('me', 'me', names), null);
  assert.equal(ownerLabelOf(null, 'me', names), null);
  assert.equal(ownerLabelOf('p_1', 'me', names), 'P1');
  assert.equal(ownerLabelOf('p_2', 'me', names), '队友');
  assert.equal(ownerLabelOf('p_3', 'me', names), '队友');
  assert.equal(ownerLabelOf('p_1', 'me', { p_1: 'P1' }), 'P1', 'a plain record works too');
  assert.equal(ownerLabelOf('p_1', 'me', null), '队友');
});
