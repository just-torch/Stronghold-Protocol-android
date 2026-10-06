// GitHub issue #181: 深靛 (秘术师) stores attack energy "找不到攻击目标时…最多3个…下次攻击时消耗所有储存的能量" (PRTS 特性).
// The clock is the unit's own attack interval; it used to be gated on `atkCd <= 0`, so it started only after the last
// attack's cooldown had run out (first charge = 2 intervals) and a 束缚 that began inside a cooldown charged nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';

const INDIGO = 'chess_char_1_17_a'; // 深靛 (秘术师)
const HOME = [10, 4];
const SPOT = [10, 6];

function battle(enemies = [{ key: 'e_dummy', pos: SPOT }]) {
  return makeBattle({
    defs: { enemies: { e_dummy: enemyRec({ key: 'e_dummy', hp: 1e7, speed: 0, atk: 0 }) } },
    units: [{ chessId: INDIGO, uid: 1, row: HOME[0], col: HOME[1], dir: 'RIGHT' }],
    enemies, timeLimit: 120, autoFinish: false,
  });
}

test('秘术师 stores its first charge after ONE attack interval when nothing can be engaged (GitHub #181)', () => {
  const h = battle([]); // nothing on the field from the start
  h.step();
  const u = h.unit(INDIGO);
  assert.ok(u.trait.stored === 0, 'no charge yet');
  assert.ok(u.s.interval > 0.5, `the interval is ${u.s.interval}s`);
  const t0 = h.b.time;
  h.runUntil(() => u.trait.stored > 0, u.s.interval * 4);
  assert.ok(u.trait.stored >= 1, 'it charges');
  const at = h.b.time - t0;
  assert.ok(at >= u.s.interval - 1e-6 && at <= u.s.interval + 0.5, `the first charge came after ${at.toFixed(2)}s (one interval, not two)`);
  checkInvariants(h.b);
});

test('秘术师 charges while its only target is 束缚 — a bind inside an attack cooldown does not stall the clock (GitHub #181)', () => {
  const h = battle();
  h.step();
  const u = h.unit(INDIGO);
  const e = h.enemies()[0]; // the harness prefixes the def id (enemy_e_dummy), so look it up by side
  assert.ok(h.runUntil(() => u.stats.attacks > 0, 20), 'she engaged the dummy first');
  assert.ok(u.atkCd > 0, 'and is inside the cooldown the old clock waited out');
  h.b.applyStatus(e, 'bind', { duration: 60 });
  const t0 = h.b.time;
  assert.equal(u.trait.stored, 0, 'no charge yet');
  h.run(u.s.interval + 0.3);
  assert.equal(u.trait.stored, 1, `one charge ${(h.b.time - t0).toFixed(2)}s after the bind, not zero`);
  assert.equal(u.stats.attacks, 1, 'and she held her fire at the bound enemy (the trait cannot target it)');
  // the bind ends: she attacks at once, and the stored energy is spent by that attack's projectile when it lands
  h.b.removeStatus(e, 'bind');
  assert.ok(h.runUntil(() => u.stats.attacks > 1, 5), 'back to attacking');
  assert.ok(h.runUntil(() => u.trait.stored === 0, 2), 'the attack spent the stored energy');
  checkInvariants(h.b);
});

test('秘术师 charges once the field is cleared, one interval after the last enemy died (GitHub #181)', () => {
  const h = battle();
  h.step();
  const u = h.unit(INDIGO);
  assert.ok(h.runUntil(() => u.stats.attacks > 0, 20), 'she engaged the dummy first');
  h.b.dealDamage(null, h.enemies()[0], { amount: 1e9, type: 'true' });
  assert.equal(h.enemies().length, 0, 'the field is empty');
  const t0 = h.b.time;
  h.runUntil(() => u.trait.stored > 0, u.s.interval * 4);
  const at = h.b.time - t0;
  assert.ok(u.trait.stored >= 1 && at <= u.s.interval + 0.5, `the first charge came ${at.toFixed(2)}s after the field cleared`);
  checkInvariants(h.b);
});
