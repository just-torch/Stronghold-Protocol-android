// test/ui/hud-bands.test.js — js/ui/fieldHost.js hudBands: the HUD geometry the prep camera has to fit between.
//
// The prep board's on-screen size is decided by that band (render/projection.js clearHud fits the whole "bench ->
// field back row" strip into it), so a stale band is not cosmetic: it either covers the bench or silently costs the
// board its height. The bands were rem constants that mirrored css/screens/game-shop.css by hand, and a phone rule
// that shortens the shop bar could not reach them; hudBands now measures the real elements and keeps the constants
// only as the fallback for when they are not on the page. These tests pin both paths.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { hudBands, HUD_REM } from '../../public/js/ui/fieldHost.js';

/** Run `fn` with a stub document (fieldHost reads bare `document` / `getComputedStyle`). */
function withDom(stubs, fn, rem = 40) {
  const prevDoc = globalThis.document;
  const prevCss = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ fontSize: `${rem}px` });
  // fieldHost walks the offsetParent chain up to .gm__hud (the shop row's offsetParent is the shop bar): the stubs
  // hang off the HUD layer like the real DOM does
  for (const [sel, el] of Object.entries(stubs)) if (el && sel !== '.gm__hud') el.offsetParent = stubs['.gm__hud'] || null;
  globalThis.document = {
    documentElement: {},
    querySelector: (sel) => (Object.hasOwn(stubs, sel) ? stubs[sel] : null),
    querySelectorAll: () => [],
  };
  try {
    return fn();
  } finally {
    globalThis.document = prevDoc;
    globalThis.getComputedStyle = prevCss;
  }
}

/**
 * A DOMRect-alike. fieldHost reads the element's own offsets inside the HUD layer (`offsetTop` / `offsetHeight`,
 * which ignore transforms — the bar and the tab animate in) plus the layer's rect for the safe-area inset, so a stub
 * carries both; `hudTop` is the layer's own top when it is inset.
 */
const box = (top, height, hudTop = 0) => ({
  top, height, bottom: top + height, left: 0, right: 800, width: 800,
  offsetTop: top - hudTop, offsetHeight: height,
  getBoundingClientRect() { return this; },
});

describe('hudBands', () => {
  test('non-prep views ask for no band', () => {
    for (const kind of ['normal', 'unite', 'boss', 'pen', 'hidden']) {
      assert.equal(withDom({}, () => hudBands(kind, { width: 800, height: 340 })), null, kind);
    }
  });

  test('falls back to the rem constants when the HUD is not on the page', () => {
    // no elements at all: the first frame, and the Node tests that drive the camera directly
    const b = withDom({}, () => hudBands('prep', { width: 800, height: 340 }));
    assert.equal(b.top, 40 * HUD_REM.bondStripBottom);
    assert.equal(b.bottom, 40 * HUD_REM.shopBarTop + HUD_REM.shopBarBorderPx);
  });

  test('measures the real HUD, so a phone rule that shortens it reaches the camera', () => {
    // what css/devices.css does on a short landscape screen: bond strip at 1.1rem (bottom 75 px), shorter cards
    // (the .shopbar__row top at 255 px on a 340 px viewport)
    const b = withDom({
      '.gm__hud': box(0, 340),
      '.gm__bonds': box(44, 31),
      '.shopbar__row': box(255, 59),
    }, () => hudBands('prep', { width: 800, height: 340 }));

    assert.equal(b.top, 75);
    assert.equal(b.bottom, 340 - 255);
    // strictly less than the constants would reserve — this is the height the board gets back
    const fallback = withDom({}, () => hudBands('prep', { width: 800, height: 340 }));
    assert.ok(b.top < fallback.top, `${b.top} < ${fallback.top}`);
    assert.ok(b.bottom < fallback.bottom, `${b.bottom} < ${fallback.bottom}`);
  });

  test('reserves the card row, not the whole shop bar (its tool buttons sit inside the band)', () => {
    // .shopbar's box starts ~50 px above .shopbar__row (the 冻结 / 刷新 / 剩余可放置角色 row): measuring the bar
    // would take that height away from the board for nothing, which is a ~12 % smaller prep board at 800×340
    const b = withDom({
      '.gm__hud': box(0, 340),
      '.gm__bonds': box(44, 31),
      '.shopbar': box(203, 128),
      '.shopbar__row': box(255, 59),
    }, () => hudBands('prep', { width: 800, height: 340 }));
    assert.equal(b.bottom, 340 - 255);
  });

  test('a safe-area inset is never given away by a measurement', () => {
    // a notched phone: the HUD layer starts below the inset, so the band can never be smaller than it
    const b = withDom({
      '.gm__hud': box(28, 312),
      '.gm__bonds': box(30, 31, 28),
      '.shopbar__row': box(255, 40, 28),
    }, () => hudBands('prep', { width: 800, height: 340 }));
    assert.equal(b.top, 61);
  });

  test('the entry animation\'s transform never reaches the band (the bar / tab are translateY\'d for ~250 ms)', () => {
    // the shop bar animates in (css/screens/game-shop.css `shop-up`: translateY(.3rem)): a band read while that is
    // mid-flight is .3rem short and the board would be framed too large — the fold's way back does read it then
    // (test/ui/mock.e2e.test.js). The offsets are the settled box; the rect (translated down 12 px here) is not.
    const stubs = { '.gm__hud': box(0, 340), '.gm__bonds': box(44, 31), '.shopbar__row': box(255 + 12, 59) };
    stubs['.shopbar__row'].offsetTop = 255; // the transform moved the rect, not the layout box
    const b = withDom(stubs, () => hudBands('prep', { width: 800, height: 340 }));
    assert.equal(b.bottom, 340 - 255);
  });

  test('both bands are capped at 40 % of the viewport height (camera sanity)', () => {
    // a degenerate measurement (a HUD element as tall as the screen) must not leave the camera no room at all
    const b = withDom({
      '.gm__hud': box(0, 200),
      '.gm__bonds': box(0, 120),
      '.shopbar__row': box(10, 20),
    }, () => hudBands('prep', { width: 800, height: 200 }));
    assert.equal(b.top, 80);
    assert.equal(b.bottom, 80);
  });

  test('the folded shop measures its tab (and keeps the corner band as a floor)', () => {
    const stubs = {
      '.gm__hud': box(0, 340),
      '.gm__bonds': box(44, 31),
      '.shopbar-tab': box(300, 35),
      '.gm__corner': null,
    };
    const b = withDom(stubs, () => hudBands('prep', { width: 800, height: 340 }, { shop: false }));
    assert.equal(b.bottom, 40, 'the folded tab band');
    assert.equal(b.top, 75);
  });
});
