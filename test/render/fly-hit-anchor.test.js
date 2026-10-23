// test/render/fly-hit-anchor.test.js — the client's hit feedback for a flying enemy, checked on the S3 真银斩 path:
// the skill has `attack.projectile: 'none'` (server/sim/content/kits/ops/chess_char_4_22-svrash.js), so the sim sends an
// `atk … 'none'` and the client draws its hit at the victim (render/fx/projectiles.js attack 'none' → _slashAt; damage →
// numbers.js _slash + damage number). Both use `_chest`, which adds `view.hover`: a FLY enemy is drawn FLY_HOVER (1.3
// tiles) up, so the spark / slash / number sit on its body, not on the tile under it. FLY_HOVER and the anchor are
// already covered by render/units.js and numbers.js — this test pins the combined path so "S3 has no projectile ⇒ no hit
// feedback on air" cannot regress.
// Run: node --test test/render/fly-hit-anchor.test.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installFakePixi, fakeViewCtx } from './fakepixi.js';
import { presetCamera } from '../../public/js/render/projection.js';
import { UF } from '../../shared/constants.js';

let fake, UnitView, FxSystem, FLY_HOVER;
before(async () => {
  fake = installFakePixi();
  ({ UnitView, FLY_HOVER } = await import('../../public/js/render/units.js'));
  ({ FxSystem } = await import('../../public/js/render/fx.js'));
});
after(() => fake.restore());

const cam = presetCamera('normal', { width: 1600, height: 900 });
const store = () => ({ picture: () => null, image: async () => null, spineEntry: () => null, spine: { acquire: async () => null, release() {} } });
const sample = (flags, x = 6, y = 9) => ({ x, y, hp: 100, maxHp: 100, sp: 0, spMax: 0, flags, anim: 1 });

test('a FLY enemy is lifted FLY_HOVER; the "none"-projectile hit (S3) draws its slash and damage number on the body', () => {
  const ctx = fakeViewCtx(fake.P, { assets: store(), cam: () => cam });
  const fly = new UnitView(ctx, { id: 2, side: 'enemy', kind: 'enemy', defId: 'enemy_1005_yokai', tier: 1, x: 6, y: 9, maxHp: 100, motion: 'FLY' }, {});
  fly.sync(sample(UF.FLYING), 1);
  for (let i = 0; i < 180; i++) fly.update(1 / 60, cam, i / 60);
  assert.ok(Math.abs(fly.hover - FLY_HOVER) < 1e-3, `hover ${fly.hover.toFixed(3)} ≈ FLY_HOVER ${FLY_HOVER}`);

  const fx = new FxSystem({
    P: fake.P, layers: fakeViewCtx(fake.P).layers, cam: () => cam, heightAt: () => 0, settings: { quality: 'high', damageNumbers: true },
    timeScale: () => 2, loadLevel: () => 0, subProfOf: () => null, view: (id) => (id === 2 ? fly : null),
    screenSize: () => ({ width: 1600, height: 900 }), fieldTop: () => 120,
  });
  // the S3 shape: an attack with no projectile visual, then its damage on the same tick (app.js 'atk' 'none' → 'dmg')
  const src = { id: 1, x: 4, y: 9, z: 0, hover: 0, _headTiles: 1.2, isEnemy: false, alive: true, destroyed: false, maxHp: 2000, info: { defId: 'chess_char_4_22_a' } };
  fx.attack(src, fly, 'none');
  fx.damage(fly, 1429, 'phys', src);
  assert.equal(fx.projs.length, 0, 'S3 / attacks with projectile none: no shot is flown');
  const chest = fx._chest(fly, {});
  const grounded = { id: 3, x: fly.x, y: fly.y, z: fly.z || 0, hover: 0, _headTiles: fly._headTiles, isEnemy: true, alive: true, destroyed: false, maxHp: 100 };
  const groundChest = fx._chest(grounded, {});
  assert.ok(chest.y < groundChest.y - 10, `the hit anchor rides the lift (${chest.y.toFixed(1)} vs ground ${groundChest.y.toFixed(1)})`);
  const slashes = fx.parts.filter((p) => p.sp.texture === fx.tex.slash);
  assert.equal(slashes.length, 2, 'the melee blow draws its two slash strokes at the victim');
  for (const s of slashes) assert.ok(Math.abs(s.sp.position.y - chest.y) < 0.5, `slash on the flying body (${s.sp.position.y.toFixed(1)} vs ${chest.y.toFixed(1)})`);
  const n = fx.nums[fx.nums.length - 1];
  assert.ok(n, 'a damage number is made');
  assert.equal(n.z0, fly.hover + fly._headTiles * 0.8, 'the number is anchored over the lifted body');
  assert.equal(n.unit, fly);
  const shown = cam.project(n.x0, n.y0, n.z0);
  assert.ok(shown.y < groundChest.y - 10, 'its screen anchor is the body, not the tile');
});
