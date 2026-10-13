// DESIGN §21.50 (GitHub issue #100): the newest snapshot's `down` list owns "is this unit on the field".
//
// render/app.js samples the PREVIOUS snapshot, so for one frame a unit can read `alive, hp > 0` there while the new
// snapshot already lists it as a 倒地干员. Standing it up in that frame made it stand and the next pass lie it down
// again — every frame, restarting its DIE clip (a stunned operator looping 倒地/起身). The fork hands the down ids to
// units.js syncView as a fourth argument; upstream v0.2.2 hoisted the per-view step out of app.js, so this is the only
// non-browser place that can hold the guard (the browser counterpart is test/render/downelem.browser.test.js, RENDER_E2E=1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncView } from '../../public/js/render/units.js';
import { ANIM } from '../../shared/constants.js';

const view = (over = {}) => ({
  id: 7, alive: false, dying: 0, info: { kind: 'op' }, synced: 0, revived: 0,
  sync() { this.synced++; }, revive() { this.revived++; },
  ...over,
});
/** The interpolated sample: not dying, hp > 0 — exactly the stale frame the guard has to ignore. */
const sample = { x: 1, y: 2, hp: 10, anim: ANIM.STUN };

test('a unit the newest snapshot lists as 倒地 is not stood up by a stale sample', () => {
  const v = view();
  syncView(v, sample, 0, new Set([7]));
  assert.equal(v.revived, 0, 'no revive');
  assert.equal(v.synced, 0, 'and nothing else ran either');
});

test('without that id (or without a down list) the revive is unchanged', () => {
  const other = view();
  syncView(other, sample, 0, new Set([8]));
  assert.equal(other.revived, 1);
  assert.equal(other.synced, 1);
  const noList = view();
  syncView(noList, sample, 0);
  assert.equal(noList.revived, 1, 'the pre-merge call shape still revives');
});

test('a living view, a dying one and a device are untouched by the down list', () => {
  const alive = view({ alive: true });
  syncView(alive, sample, 0, new Set([7]));
  assert.deepEqual([alive.synced, alive.revived], [1, 0], 'a living view takes the sample');
  const dying = view({ dying: 0.4 });
  syncView(dying, sample, 0, new Set([7]));
  assert.deepEqual([dying.synced, dying.revived], [0, 0], 'a dying view only follows the position');
  assert.deepEqual([dying.x, dying.y], [1, 2]);
  const device = view({ info: { kind: 'device' } });
  syncView(device, sample, 0, new Set([7]));
  assert.equal(device.synced, 1, 'a device syncs');
});

test('a DIE sample or an empty HP bar never revived either way', () => {
  const die = view();
  syncView(die, { ...sample, anim: ANIM.DIE }, 0, null);
  assert.equal(die.revived, 0);
  const dead = view();
  syncView(dead, { ...sample, hp: 0 }, 0, null);
  assert.equal(dead.revived, 0);
});
