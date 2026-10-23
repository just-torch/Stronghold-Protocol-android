// test/content/svrash-s3-air.test.js — 银灰 (chess_char_4_22_a, 领主: ranged, canHitFly) S3 真银斩 vs air units.
// The kit is server/sim/content/kits/ops/chess_char_4_22-svrash.js `skill:` (skchr_svrash_3, duration 23 s,
// attack.projectile 'none' — "视为近距离攻击": no ranged ×0.8 — and attack@max_target 4).
//
// Regression guard: a real 妖怪 drone (enemy_1005_yokai, 800 HP) dies to SilverAsh's *normal* attacks before S3 is even
// charged, which can read as "S3 does not hit air"; a synthetic high-HP target isolates the skill. The engine's only
// air filter is server/sim/ai.js:412 (`!prof.canHitFly && e.isFlying && !prof.splashHitsFly`), and S3 inherits the 领主
// profile's canHitFly: true. Also covers docs/SIM.md's air-unit rule: 近地悬浮 (flag `float`) and 浮空 (`levitate`) are
// air units (`Unit.isFlying`), so the S3 hits them — and since 2026-10-23 the snapshot's UF.FLYING follows the same
// getter, so the client draws (and lifts) them as the air units the sim treats them as, while a 缚地 enemy drops back.
// Run: node --test test/content/svrash-s3-air.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { flagsOf } from '../../server/sim/snapshot.js';
import { UF } from '../../shared/constants.js';

const SVRASH = 'chess_char_4_22_a';
const DUMMY = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, ...o });
const approx = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);

/** SilverAsh at (10,5) facing RIGHT, a long battle clock, no auto-finish: synthetic targets are spawned when needed. */
function field(extraDefs = {}) {
  const h = makeBattle({
    defs: {
      enemies: {
        enemy_ground: DUMMY('enemy_ground'),
        enemy_air: DUMMY('enemy_air', { motion: 'FLY' }),
        enemy_hover: DUMMY('enemy_hover'),
        enemy_lev: DUMMY('enemy_lev'),
        ...extraDefs,
      },
    },
    timeLimit: 600, autoFinish: false, seed: 7,
    units: [{ chessId: SVRASH, row: 10, col: 5 }],
    hooks: ['damaged', 'kill', 'skillStart', 'skillEnd', 'statusApplied'], captureNoisy: true,
  });
  h.step();
  return { h, u: h.unit(SVRASH) };
}
const skillHits = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && c.dmg?.isAttack && c.dmg.isSkill);
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
/** Charge + activate S3 from full SP without waiting for its 90 s gauge. */
function cast(h, u) {
  u.skill.gainSp(999);
  assert.equal(u.skill.activate('test'), true, 'S3 activates');
  assert.ok(u.skill.active);
}

test('S3 真银斩: 领主 canHitFly stays true, the skill keeps the "no ranged ×0.8" profile and kills a motion FLY enemy', () => {
  // two S3 strikes at E2 Lv1 knock this one out; spawned after the cast so no normal attack can take it first
  const { h, u } = field({ enemy_air_weak: DUMMY('enemy_air_weak', { motion: 'FLY', hp: 2000 }) });
  // the base profile: ranged arrows that already hit air (the S3 overrides projectile to 'none' only while active)
  assert.deepEqual([u.profile.attack, u.profile.projectile, u.profile.canHitFly], ['ranged', 'arrow', true]);
  assert.equal(u.skill.id, 'skchr_svrash_3');
  cast(h, u);
  assert.equal(u.profile.canHitFly, true, 'the active profile still canHitFly');
  // spawn after the cast so the normal attack cannot kill it first (the 妖怪 trap of the original repro)
  const fly = h.spawn('enemy_air_weak', { pos: [10, 6] });
  assert.ok(fly.isFlying && flagsOf(fly) & UF.FLYING, 'FLY: an air unit and the client FLYING bit');
  assert.ok(h.runUntil(() => !fly.alive, 6), 'S3 knocks it out');
  const hits = skillHits(h, u).filter((c) => c.target === fly);
  assert.ok(hits.length >= 2, `${hits.length} S3 hits`);
  for (const c of hits) {
    approx(c.amount, u.s.atk, 'S3 damage = ATK (视为近距离攻击: no ×0.8)');
    assert.deepEqual([c.type, c.target.isFlying], ['phys', true]);
  }
  const kill = h.hooksOf('kill').find((c) => c.victim === fly);
  assert.ok(kill && kill.killer === u, 'the kill is credited to 银灰');
  done(h);
});

test('S3 keeps attack@max_target 4: one strike takes four air targets, every instance at the no-×0.8 damage', () => {
  const { h, u } = field();
  cast(h, u);
  const air = [[10, 6], [10, 7], [10, 8], [9, 6]].map((pos) => h.spawn('enemy_air', { pos }));
  assert.ok(h.runUntil(() => skillHits(h, u).length >= 4, 3), 'the first S3 strike hits');
  const first = skillHits(h, u)[0];
  const volley = skillHits(h, u).filter((c) => c.dmg.attackId === first.dmg.attackId);
  assert.equal(volley.length, 4, 'attack@max_target 4');
  assert.deepEqual(volley.map((c) => c.target).sort((a, b) => a.id - b.id), air.sort((a, b) => a.id - b.id), 'four distinct air targets');
  for (const c of volley) { approx(c.amount, u.s.atk); assert.ok(c.target.isFlying); }
  done(h);
});

test('近地悬浮 (float) and 浮空 (levitate) are air units: S3 hits both (they are WALK movers, as docs/SIM.md says)', () => {
  const { h, u } = field();
  const hover = h.spawn('enemy_hover', { pos: [10, 6] });
  h.b.addBuff(hover, { key: 'ab:float', flags: { float: true, unblockable: true, noDisplace: true }, persist: true });
  const lev = h.spawn('enemy_lev', { pos: [10, 7] });
  assert.equal(h.b.applyStatus(lev, 'levitate', { duration: 9, source: null }), true, '浮空 applied');
  const ground = h.spawn('enemy_ground', { pos: [9, 5] });
  assert.deepEqual([hover.motion, hover.isFlying], ['WALK', true], '近地悬浮: a WALK mover that is an air unit');
  assert.deepEqual([lev.motion, lev.isFlying], ['WALK', true], '浮空: a WALK mover that is an air unit');
  assert.equal(ground.isFlying, false);
  // the client's FLYING bit (server/sim/snapshot.js flagsOf): the same getter, so hovering / levitated enemies are
  // lifted and drawn as air units instead of standing on the ground
  assert.ok(flagsOf(hover) & UF.FLYING, '近地悬浮: the snapshot FLYING bit');
  assert.ok(flagsOf(lev) & UF.FLYING, '浮空: the snapshot FLYING bit');
  assert.equal(flagsOf(ground) & UF.FLYING, 0, 'a ground enemy: no FLYING bit');
  cast(h, u);
  assert.ok(h.runUntil(() => [hover, lev, ground].every((e) => skillHits(h, u).some((c) => c.target === e)), 3), 'S3 hits all three');
  for (const e of [hover, lev, ground]) {
    const hit = skillHits(h, u).find((c) => c.target === e);
    approx(hit.amount, u.s.atk, `${e.defId}: S3 damage = ATK`);
    assert.equal(!!(hit.target.isFlying), e !== ground, `${e.defId}: air / ground`);
  }
  // 缚地 makes an air unit a ground one again (Unit.isFlying) — the snapshot bit follows it back down
  h.b.applyStatus(hover, 'groundbind', { duration: 9, source: null });
  assert.equal(hover.isFlying, false, '缚地: a ground unit');
  assert.equal(flagsOf(hover) & UF.FLYING, 0, '缚地: the FLYING bit is cleared');
  done(h);
});
