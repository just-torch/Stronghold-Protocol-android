// test/render/warm-art.test.js — ui/warmArt.js: the battle art a room warms in the background (main.js warmGameData).
// Pure / injected store: no DOM, no network.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { warmBattleArt } from '../../public/js/ui/warmArt.js';
import { battleArtUrls } from '../../public/js/assets.js';

const MANIFEST = {
  ui: {
    'battle/sprite_shadow': '/ui/shadow.png',
    'entry/bg_mountains_tiled': '/ui/mountains.png',
    'skillIcon/empty': '/ui/empty.png',
  },
  prof: { icon: { sniper: '/prof/sniper.png' }, battlecard: { token: '/prof/token.png' }, sub: { fastshot: '/prof/sub/fastshot.png' } },
  bonds: { yanShip: '/b/yan.png' },
  bands: { band_bldsk: '/band/bldsk.png' },
};

/** A store stand-in recording what warmBattleArt asks of it (`known`: its manifest before a seed). */
function fakeStore(calls, known = MANIFEST) {
  return {
    seed(manifest) { calls.push(['seed', manifest]); return true; },
    get manifest() { return known; },
    preload(urls) { calls.push(['preload', urls]); return Promise.resolve({ ok: urls.length, failed: 0, total: urls.length }); },
  };
}

describe('warmBattleArt', () => {
  test('seeds the data store copy, then preloads exactly the battle art', async () => {
    const calls = [];
    const r = await warmBattleArt({ assets: fakeStore(calls), manifest: MANIFEST });
    assert.deepEqual(calls.map((c) => c[0]), ['seed', 'preload']);
    assert.equal(calls[0][1], MANIFEST, 'the game data\'s own copy (no second download)');
    assert.deepEqual(calls[1][1], battleArtUrls(MANIFEST));
    assert.deepEqual(r, { ok: calls[1][1].length, failed: 0, total: calls[1][1].length });
  });

  test('takes the manifest from the data store when none is passed (data.getRaw)', async () => {
    const calls = [];
    const r = await warmBattleArt({ assets: fakeStore(calls), getRaw: (name) => (name === 'assets' ? MANIFEST : null) });
    assert.deepEqual(calls[0], ['seed', MANIFEST]);
    assert.ok(r.total > 0);
    assert.deepEqual(calls[1][1], battleArtUrls(MANIFEST));
  });

  test('nothing to warm: resolves zero counts, does not seed, never rejects', async () => {
    const calls = [];
    assert.deepEqual(await warmBattleArt({ assets: fakeStore(calls, null), manifest: {} }), { ok: 0, failed: 0, total: 0 });
    assert.deepEqual(calls, [], 'an empty manifest is not adopted and nothing is preloaded');
    // a store without preload / seed (a caller passing the raw manifest) is a no-op too
    assert.deepEqual(await warmBattleArt({ assets: { manifest: null }, manifest: null, getRaw: () => null }), { ok: 0, failed: 0, total: 0 });
    // a failing warm-up is swallowed (it is optional background work)
    const broken = { manifest: MANIFEST, preload: async () => { throw new Error('offline'); } };
    const warn = console.warn; console.warn = () => {};
    try {
      assert.deepEqual(await warmBattleArt({ assets: broken, manifest: MANIFEST }), { ok: 0, failed: 0, total: 0 });
    } finally { console.warn = warn; }
  });

  test('save-data is respected (no background download behind the player\'s back)', async () => {
    const calls = [];
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { connection: { saveData: true } }, configurable: true });
    try {
      assert.deepEqual(await warmBattleArt({ assets: fakeStore(calls), manifest: MANIFEST }), { ok: 0, failed: 0, total: 0, skipped: 'save-data' });
      assert.deepEqual(calls, []);
    } finally {
      if (desc) Object.defineProperty(globalThis, 'navigator', desc); else delete globalThis.navigator;
    }
  });
});
