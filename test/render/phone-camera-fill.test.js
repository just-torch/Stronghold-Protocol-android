// test/render/phone-camera-fill.test.js — the prep camera on a phone in landscape (projection.js clearHud `fill`).
//
// At 1080p the official prep camera frames the "bench -> field back row" band so that it exactly fills the space the
// HUD leaves, and `clearHud` only ever corrected a band that did NOT fit (it panned it or zoomed out). A phone in
// landscape is a different viewport: css/theme.css floors the root font size at 40 px, so the HUD claims a larger
// share of the height, and the official camera then leaves the band slack (42.7 px per tile at 915×412 where the
// space between the bands allows 43.7). `PHONE_FILL_MAX_H` makes the fit two-way below that height (the same
// threshold as the phone CSS rules): the band fills the space, capped so the board's widest row stays between the
// HUD's side panels and never smaller than the official framing.
//
// What the phone CSS does NOT do is shrink the shop bar: those cards keep their 2.24 rem design height (user
// decision), so the bands are 70.78 px (compact bond strip) + 108.59 px (stock shop bar) at 915×412 and the fill
// buys ~2 %. The second case below shows the same fill with the shop bar a diet would leave — the mechanic is what
// is tested here, the card height is a product decision (css/devices.css section 5).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { presetCamera, CAMERA_PRESETS, PHONE_FILL_MAX_H } from '../../public/js/render/projection.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The bands shipping today at 915×412, measured in the APK's WebView (android/scripts/fit-check.mjs): the compact
 *  bond strip of css/devices.css section 5, and the shop bar at its design height. */
const PHONE_HUD = { top: 70.78, bottom: 108.59 };
/** …and what a shorter shop bar would leave (measured with 1.06 rem cards: 1.36 rem + 3 px of bottom band). */
const SHORT_SHOP_HUD = { top: 70.78, bottom: 57.39 };
const phone = (W, H, hud, pad) => presetCamera('prep', { width: W, height: H, padding: pad }, hud ? { hud } : {});

/** The band's screen span with `cam` (the rows the prep camera has to keep clear). */
function band(cam, H) {
  const keep = CAMERA_PRESETS.prep.keep;
  const far = cam.project(cam.tx, keep.far, keep.zFar).y;
  const near = cam.project(cam.tx, keep.near, keep.zNear).y;
  return { far, near, span: near - far, free: H - PHONE_HUD.top - PHONE_HUD.bottom };
}

describe('prep camera on a short viewport (fill)', () => {
  test('fills the space the HUD leaves instead of stopping at the official framing', () => {
    const official = phone(915, 412, null);
    const filled = phone(915, 412, PHONE_HUD, { left: 90, right: 36 });
    assert.ok(filled.scale >= official.scale, `filled ${filled.scale} < official ${official.scale}`);
    const b = band(filled, 412);
    assert.ok(Math.abs(b.span - (412 - PHONE_HUD.top - PHONE_HUD.bottom)) < 3,
      `band ${b.span.toFixed(1)} should fill the ${b.free.toFixed(1)} px between the HUD bands`);
    assert.ok(b.far >= PHONE_HUD.top - 0.5 && b.near <= 412 - PHONE_HUD.bottom + 0.5, 'band inside the HUD bands');
    // the shop bar keeps its design height, so the slack the official framing leaves is small (…) but real
    assert.ok(filled.scale > official.scale, 'the fill still buys something with the stock shop bar');
    // …and with the shop bar shorter (the rejected diet) the same code takes the whole space: that is the point
    const shortShop = phone(915, 412, SHORT_SHOP_HUD, { left: 90, right: 36 });
    assert.ok(shortShop.scale > official.scale * 1.2,
      `a shorter bar would give ${shortShop.scale.toFixed(1)} vs the official ${official.scale.toFixed(1)}`);
    assert.ok(Math.abs(band(shortShop, 412).span - (412 - SHORT_SHOP_HUD.top - SHORT_SHOP_HUD.bottom)) < 3);
  });

  test('keeps the official framing on tablet / desktop viewports', () => {
    for (const [W, H, hud] of [[1280, 822, { top: 142.63, bottom: 178.97 }], [1920, 1080, { top: 214, bottom: 267 }]]) {
      const official = phone(W, H, null);
      const withHud = phone(W, H, hud, { left: Math.min(170, W * 0.09), right: W * 0.05 });
      assert.equal(withHud.scale, official.scale, `${W}×${H} is above the phone threshold and must not zoom`);
    }
    // the threshold is the phone one: one pixel above it the fill is off, one below it is on
    const tall = phone(800, PHONE_FILL_MAX_H + 1, { top: 70, bottom: 90 }, { left: 90, right: 36 });
    const short = phone(800, PHONE_FILL_MAX_H - 40, { top: 70, bottom: 90 }, { left: 90, right: 36 });
    assert.equal(tall.scale, phone(800, PHONE_FILL_MAX_H + 1, null).scale);
    assert.ok(short.scale > phone(800, PHONE_FILL_MAX_H - 40, null).scale);
  });

  test('never zooms out: a narrow viewport caps the fill instead', () => {
    // 4:3-ish and floored root font size: the free height wants a board wider than the screen, so the width wins
    for (const [W, H] of [[620, 460], [640, 480], [700, 440]]) {
      const official = phone(W, H, null);
      const hud = { top: 86.4, bottom: 108.6 }; // the stock bands (the phone rules stop at PHONE_FILL_MAX_H)
      const filled = phone(W, H, hud, { left: Math.min(170, W * 0.09), right: W * 0.05 });
      assert.ok(filled.scale >= official.scale - 1e-9, `${W}×${H}: ${filled.scale} < official ${official.scale}`);
      const keep = CAMERA_PRESETS.prep.keep;
      const z = keep.zNear;
      const left = filled.project(-0.5, keep.near, z).x;
      const right = filled.project(10.5, keep.near, z).x;
      assert.ok(left >= -1 && right <= W + 1, `${W}×${H}: board rows ${left.toFixed(1)}..${right.toFixed(1)} off screen`);
    }
  });

  test('PHONE_FILL_MAX_H is the css/devices.css phone breakpoint (one decision, not two)', () => {
    const css = read('public/css/devices.css');
    const gate = `@media (max-height: ${PHONE_FILL_MAX_H}px) and (pointer: coarse), `
      + `(max-height: ${PHONE_FILL_MAX_H}px) and (any-pointer: coarse) {`;
    assert.ok(css.includes(gate), 'the phone HUD block is gated on PHONE_FILL_MAX_H');
    // …and it is the block that shortens the top band the prep camera pays for, while leaving the shop bar alone
    const block = css.slice(css.indexOf(gate), css.indexOf('/* ---- 4. misc'));
    assert.match(block, /\.gm__bonds \{ top: [\d.]+rem; \}/);
    assert.doesNotMatch(block, /\.scard, \.lvcard \{ height/, 'the shop cards keep their design height on phones');
  });
});
