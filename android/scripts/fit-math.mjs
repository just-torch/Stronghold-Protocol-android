// android/scripts/fit-math.mjs — the prep-vs-battle board scale, computed from the camera code alone.
//
//   node android/scripts/fit-math.mjs [--viewport WxH ...]
//
// Why this is separate from fit-check.mjs: the answer is pure arithmetic (render/projection.js presetCamera), and
// driving it through a browser is both slow and unreliable for this particular question — the dev mock's COMBAT
// phase keeps the prep field camera, so it reports a ratio of exactly 1.000 everywhere and hides the real drift.
// This evaluates the shipping functions directly.
//
// What it reports per viewport: the CSS root font-size the game computes (theme.css), the HUD bands the prep camera
// keeps clear (fieldHost.js) and the tile size (px) each phase's camera produces at the board's middle.
//
// The ratio column is the finding, not a target: every prep camera is further from the board than the battle camera
// (left_shop_camera_param height 11.53 / left_prepare_camera_param 10.22 against the battle camera's 8.36) and
// clearHud shrinks it further to keep the bench clear of the HUD, so the prep board is 60-82 % of the battle board
// and the map does visibly change size when the phase changes. Closing that gap is a product decision, not a tweak:
// the 6-row band the prep camera keeps clear (bench -> the field's back row) needs ~300 px at the battle tile size
// and no phone has that, so matching exactly means either the bench under the shop bar or the field's back row under
// the bond strip — and test/ui/issue5-fold-camera.test.js asserts against the latter on purpose.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const { presetCamera } = await import(pathToFileURL(path.join(ROOT, 'public', 'js', 'render', 'projection.js')).href);

const argv = process.argv.slice(2);
const viewports = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== '--viewport') continue;
  const m = /^(\d+)x(\d+)$/i.exec(argv[i + 1] || '');
  if (!m) { console.error(`--viewport wants WxH, got ${argv[i + 1]}`); process.exit(2); }
  viewports.push([Number(m[1]), Number(m[2])]);
}
if (!viewports.length) {
  // the design target, plus phone viewports from the repo's own UI tests
  viewports.push([1920, 1080], [915, 412], [900, 415], [844, 390], [800, 360], [756, 366], [640, 360]);
}

/** theme.css: html { font-size: clamp(40px, min(100vw/19.2, 100svh/10.8), 240px) } */
const rootRem = (W, H) => Math.min(240, Math.max(40, Math.min(W / 19.2, H / 10.8)));

/** fieldHost.js hudBands('prep', size): the band the prep camera keeps the bench -> back row inside, with no notch.
 *  Those heights come from the CSS (css/screens/game-shop.css, css/screens/game.css) — the default is the rem
 *  constants HUD_REM (= 2.16 rem top, 2.64 rem + 3 px bottom), and css/devices.css section 5 shortens only the TOP
 *  band on a short landscape screen (the bond strip sits at 1.1 rem with compact slots: ≈ 1.77 rem). The shop bar
 *  keeps its design height: the cards are 2.24 rem at every viewport. hudBands MEASURES the page, so this model is
 *  only as good as these numbers; prefer `fit-check.mjs`, which reads the real elements, whenever a value matters. */
const prepHud = (W, H, folded = false) => {
  const rem = rootRem(W, H);
  const short = H <= 460;
  return {
    top: Math.min(H * 0.4, rem * (short ? 1.77 : 2.16)),
    bottom: folded
      ? Math.min(H * 0.4, rem * 0.8 + 3)
      : Math.min(H * 0.4, rem * 2.64 + 3),
  };
};

/** The horizontal claims the fill (`clearHud` `opts.bounds`) caps the board with: ui/fieldHost.js hudPadding's
 *  left/right (the team panel column / the effects column) — the prep camera's own padding, not the fitted model. */
const prepPad = (W, H) => {
  const rem = rootRem(W, H);
  return { top: H * 0.1, bottom: H * 0.24, left: Math.min(170, rem * 2.25), right: rem * 0.9 };
};

const padding = (kind, W, H) => (kind === 'prep'
  ? prepPad(W, H)
  : { top: H * 0.13, bottom: H * 0.12, left: Math.min(170, W * 0.09), right: W * 0.05 });

const rows = [];
for (const [W, H] of viewports) {
  const hudOpen = prepHud(W, H, false);
  const hudFolded = prepHud(W, H, true);
  const ship = (hud, shop) => presetCamera('prep', { width: W, height: H, padding: padding('prep', W, H) },
    shop === undefined ? { hud } : { hud, shop }).scale;
  const battle = presetCamera('normal', { width: W, height: H, padding: padding('normal', W, H) }, {}).scale;
  rows.push({
    viewport: `${W}×${H}`,
    hudPct: (((hudOpen.top + hudOpen.bottom) / H) * 100).toFixed(1),
    hudFoldedPct: (((hudFolded.top + hudFolded.bottom) / H) * 100).toFixed(1),
    battle,
    open: ship(hudOpen),
    folded: ship(hudFolded, false),
  });
}

const pct = (v, base) => `${((v / base) * 100).toFixed(0)}%`;
console.log('fit-math — px per board tile, prep vs battle (what the shipping cameras actually do)');
console.log(`  ${'viewport'.padEnd(11)}${'HUD%'.padStart(6)}${'HUD%fold'.padStart(9)}${'battle'.padStart(8)}${'prep'.padStart(8)}${'prep/battle'.padStart(12)}${'folded'.padStart(8)}${'fold/battle'.padStart(12)}`);
for (const r of rows) {
  console.log(`  ${r.viewport.padEnd(11)}${r.hudPct.padStart(6)}${r.hudFoldedPct.padStart(9)}${r.battle.toFixed(1).padStart(8)}${r.open.toFixed(1).padStart(8)}${pct(r.open, r.battle).padStart(12)}${r.folded.toFixed(1).padStart(8)}${pct(r.folded, r.battle).padStart(12)}`);
}
console.log('\n  battle  = the battle/normal camera (left_battle_camera_param)');
console.log('  prep    = prep camera, shop OPEN  (left_shop_camera_param + clearHud)');
console.log('  folded  = prep camera, shop FOLDED (left_prepare_camera_param; the band is only the folded tab, so the');
console.log('            board is bigger, but still not the battle size)');
console.log('  100 % would mean the map does not change size between the prep phase and the battle. It is not reached:');
console.log('  see the header for the two invariants that cap it.');
