// test/ui/mystic-energy.test.js — the 秘术师 half of 设置「显示弹药与能量数量」 (0.3.1; 「秘术师能量」 was PR #636 by
// @zasx77771, GitHub #633, DESIGN §32.14.28): a 秘术师's stored attack energies as stored/cap under the HP bar are not part
// of the official HUD — the client shows them as an effect on the operator — so the count is an option, off by default
// (the maintainer's decision of 2026-10-15). 0.3.1 merged it with 「弹药数量」 into one switch: the retired `mysticEnergy`
// key migrates to it and is no longer stored. Settings normalisation, the merged hint in every language pack, the field
// view's live setting and the energy readout. What the renderer draws: test/render/hud-readouts.test.js. The ammo half
// and the dialog toggle itself: test/ui/ammo-count.test.js.
// Run: node --test test/ui/mystic-energy.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../../public/js/ui/gameLogic.js';
import { buildDiagnostics } from '../../public/js/diag.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const LABEL = '显示弹药与能量数量';
const HINT = '弹药类技能开启时，在弹药条下方显示剩余弹药 / 总弹药数（如 13/14）；秘术师的血条下方显示储存的攻击能量 / 上限（如 2/3）。官方界面没有这些数字。';

test('mysticEnergy migrates into the merged switch: off by default, the retired key on means on, a boolean kept, junk off', () => {
  assert.equal(DEFAULT_SETTINGS.ammoEnergyCount, false);
  assert.equal(sanitizeSettings(null).ammoEnergyCount, false);
  assert.equal(sanitizeSettings({ bgm: 0.4, ammoCount: true }).ammoEnergyCount, true, 'a profile saved with 弹药数量 on');
  assert.equal(sanitizeSettings({ bgm: 0.4 }).ammoEnergyCount, false, 'a profile saved before 0.3.0');
  assert.equal(sanitizeSettings({ mysticEnergy: true }).ammoEnergyCount, true, 'the retired 秘术师能量 key, on');
  assert.equal(sanitizeSettings({ mysticEnergy: false }).ammoEnergyCount, false);
  for (const bad of ['true', 1, 0, null, {}, []]) assert.equal(sanitizeSettings({ mysticEnergy: bad }).ammoEnergyCount, false, JSON.stringify(bad));
  assert.equal('mysticEnergy' in sanitizeSettings({ mysticEnergy: true }), false, 'the retired key is not stored again');
  assert.deepEqual(sanitizeSettings({ mysticEnergy: true, ammoCount: true }), { ...sanitizeSettings({ ammoCount: true }), ammoEnergyCount: true });
  // [ASSUMED] the merged boolean wins, so turning the switch off stays off even with a retired key left behind
  assert.equal(sanitizeSettings({ mysticEnergy: true, ammoEnergyCount: false }).ammoEnergyCount, false);
});

test('the merged hint names the energy count in every language pack; the retired option has no toggle of its own', () => {
  const src = read('public/js/ui/settings.js');
  assert.ok(src.includes(`t('${HINT}')`), 'the hint under the merged toggle');
  assert.ok(src.indexOf("t('官方伤害数字')") < src.indexOf(`t('${LABEL}')`), 'below the damage-number options');
  assert.ok(!src.includes("t('秘术师能量')"), 'no separate 秘术师能量 row is left');
  for (const lang of ['en', 'ja', 'ko', 'zh-TW']) {
    const pack = JSON.parse(read(`public/i18n/${lang}.json`));
    for (const id of [LABEL, HINT]) assert.ok(typeof pack[id] === 'string' && pack[id].length > 0, `${lang}: ${id}`);
    assert.match(pack[HINT], /2\/3/, `${lang}: the example count`);
  }
});

test('the field view takes the merged setting at creation and live (setSettings); a 秘术师 reads it from the shared settings', () => {
  const app = read('public/js/render/app.js');
  assert.match(app, /if \(typeof s\.ammoEnergyCount === 'boolean'\) settings\.ammoEnergyCount = s\.ammoEnergyCount;/);
  const units = read('public/js/render/units.js');
  assert.match(units, /this\._updateEnergy\(showBars && !this\.isEnemy && !!this\.energy && this\.ctx\.settings\?\.ammoEnergyCount === true, x0, rowsTop \+ wolfH \+ coinH, s\)/);
});

test('the diagnostics name the merged option when it is on', () => {
  const state = { me: {}, room: null, match: { public: null, battle: null }, connection: { status: 'online' } };
  const line = (settings) => buildDiagnostics({ state, env: {}, settings }).split('\n').find((l) => l.startsWith('settings:'));
  assert.equal(line({ quality: 'high', damageNumbers: true, ammoEnergyCount: true }), 'settings: quality high | damage numbers | ammo and energy counts');
  assert.equal(line({ quality: 'high', damageNumbers: true, ammoEnergyCount: false }), 'settings: quality high | damage numbers');
});
