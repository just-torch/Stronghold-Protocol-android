// test/ui/ammo-count.test.js — 设置「显示弹药与能量数量」 (0.3.1): the merged switch for the remaining ammo count under an ammo
// skill's bar (「弹药数量」, PR #552, 0.2.6) and the stored attack energies under a 秘术师's HP bar (「秘术师能量」, PR #636,
// 0.3.0). Neither count is part of the official HUD — the client shows the energy as an effect on the operator — so both
// are one option, off by default (the maintainer's decision of 2026-10-13, like 「官方伤害数字」; merged in 0.3.1).
// A profile saved with either retired key on migrates to the merged switch being on; the old two keys are no longer
// stored. Settings normalisation, the dialog's toggle and its hint in every language pack, the field view's live setting,
// the diagnostics line. What the renderer draws: test/render/hud-readouts.test.js. The 秘术师 half of the merge:
// test/ui/mystic-energy.test.js.
// Run: node --test test/ui/ammo-count.test.js

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

test('ammoEnergyCount is stored with the other settings: off by default, a profile saved before it, a boolean kept, junk off', () => {
  assert.equal(DEFAULT_SETTINGS.ammoEnergyCount, false);
  assert.equal(sanitizeSettings(null).ammoEnergyCount, false);
  assert.equal(sanitizeSettings({ bgm: 0.4, officialDamageNumbers: true }).ammoEnergyCount, false, 'a profile saved before 0.2.6');
  assert.equal(sanitizeSettings({ ammoEnergyCount: true }).ammoEnergyCount, true);
  assert.equal(sanitizeSettings({ ammoEnergyCount: false }).ammoEnergyCount, false);
  for (const bad of ['true', 1, 0, null, {}, []]) assert.equal(sanitizeSettings({ ammoEnergyCount: bad }).ammoEnergyCount, false, JSON.stringify(bad));
  // 0.3.1 merged 「弹药数量」 (ammoCount) into it: a profile saved with the old option on migrates to the merged one
  assert.equal(sanitizeSettings({ ammoCount: true }).ammoEnergyCount, true, 'the retired 弹药数量 key, on');
  assert.equal(sanitizeSettings({ ammoCount: false }).ammoEnergyCount, false);
  assert.equal(sanitizeSettings({ ammoCount: 'true' }).ammoEnergyCount, false, 'only a boolean true migrates');
  // the old keys are read, never written back
  const migrated = sanitizeSettings({ ammoCount: true });
  assert.equal('ammoCount' in migrated, false, 'the retired key is not stored again');
  assert.equal('mysticEnergy' in migrated, false);
  // independent of the damage-number switches
  assert.deepEqual(sanitizeSettings({ ammoCount: true, damageNumbers: false, officialDamageNumbers: true }), { ...sanitizeSettings({ damageNumbers: false, officialDamageNumbers: true }), ammoEnergyCount: true });
});

test('the settings dialog has the one toggle and a hint naming both counts, in every language pack', () => {
  const src = read('public/js/ui/settings.js');
  assert.match(src, /<\$\{Toggle\} label=\$\{t\('显示弹药与能量数量'\)\} micro="AMMO & ENERGY" value=\$\{s\.ammoEnergyCount\} onChange=\$\{\(v\) => updateSettings\(\{ ammoEnergyCount: v \}\)\} \/>/);
  assert.ok(src.includes(`t('${HINT}')`), 'the hint under it');
  assert.ok(src.indexOf("t('官方伤害数字')") < src.indexOf(`t('${LABEL}')`), 'beside the damage-number options');
  assert.ok(!src.includes("t('弹药数量')") && !src.includes("t('秘术师能量')"), 'the retired two options have no toggle of their own');
  for (const lang of ['en', 'ja', 'ko', 'zh-TW']) {
    const pack = JSON.parse(read(`public/i18n/${lang}.json`));
    for (const id of [LABEL, HINT]) assert.ok(typeof pack[id] === 'string' && pack[id].length > 0, `${lang}: ${id}`);
    assert.match(pack[HINT], /13\/14/, `${lang}: the ammo example count`);
    assert.match(pack[HINT], /2\/3/, `${lang}: the energy example count`);
  }
});

test('the field view takes the merged setting at creation and live (setSettings); the units read it from their shared settings', () => {
  const app = read('public/js/render/app.js');
  assert.match(app, /const settings = \{ damageNumbers: true, officialDamageNumbers: false, ammoEnergyCount: false, quality: 'high', officialFx: 'auto', \.\.\.\(opts\.settings \|\| \{\}\) \};/);
  assert.match(app, /if \(typeof s\.ammoEnergyCount === 'boolean'\) settings\.ammoEnergyCount = s\.ammoEnergyCount;/);
  const units = read('public/js/render/units.js');
  assert.match(units, /this\._updateAmmoCount\(showSp && !!ammo && this\.ctx\.settings\?\.ammoEnergyCount === true, x0 \+ bw \/ 2, rowsTop, s\)/);
  // the simplified board draws no ammo bar (its SP bar is the tuple's SP), so it has nothing to count under
  assert.doesNotMatch(read('public/js/ui/fallbackField.js'), /ammo/);
});

test('the diagnostics name the option when it is on', () => {
  const state = { me: {}, room: null, match: { public: null, battle: null }, connection: { status: 'online' } };
  const line = (settings) => buildDiagnostics({ state, env: {}, settings }).split('\n').find((l) => l.startsWith('settings:'));
  assert.equal(line({ quality: 'high', damageNumbers: true, ammoEnergyCount: true }), 'settings: quality high | damage numbers | ammo and energy counts');
  assert.equal(line({ quality: 'high', damageNumbers: true, ammoEnergyCount: false }), 'settings: quality high | damage numbers');
});
