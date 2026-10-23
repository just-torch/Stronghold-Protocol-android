// test/ui/scout-shop-badge.test.js — the 「正在查看 X 的调度中心（只读）」 badge (休整期观战队友商店, 2026-10-23) rides the
// shop bar it belongs to. The first cut was a sibling of the bar in the HUD layer, placed at a fixed `bottom: 3.16rem`;
// on a phone whose bar grew (the tools row stacks 剩余可放置角色 above 冻结 / 刷新) the badge covered both the counter and
// the two buttons (report 2026-10-23, screenshot). It is now rendered by ShopBar itself and anchored to the bar's own
// box, so no bar height can put it inside the bar's content.
//
// Also guards the team panel's avatar ring: `.pavatar` draws 「你」/the watched player with a 2 px box-shadow ring, and the
// scroll container added for 8-seat rooms clipped it at the panel's edge ("左边玩家头像边框不完整").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('ShopBar renders the badge inside its own box (a bar that grows cannot overlap it)', () => {
  const src = read('public/js/ui/shopBar.js');
  const section = src.indexOf(`<section class=\${cx('shopbar'`);
  const badge = src.indexOf('<div class="shopbar__badge">');
  const tools = src.indexOf('<div class="shopbar__tools">');
  assert.ok(section > 0 && badge > section && tools > badge, 'the badge is the first child of the .shopbar section');
  const tab = src.indexOf('class="shopbar-tab"');
  const tabBadge = src.indexOf('shopbar__badge is-tab');
  assert.ok(tab > 0 && tabBadge > tab && tabBadge < src.indexOf('shopbar-tab__funds'), 'the folded tab carries its own copy');
  assert.match(src, /badge = null /, 'the badge is an optional prop');
});

test('the badge is anchored to the bar (bottom: 100%), never to a fixed offset from the screen bottom', () => {
  const css = read('public/css/screens/game-shop.css');
  const block = css.slice(css.indexOf('.shopbar__badge {'));
  assert.match(block.slice(0, 600), /bottom: calc\(100% \+/, 'anchored to the bar box');
  assert.doesNotMatch(block.slice(0, 600), /bottom: \d+(\.\d+)?rem/, 'no fixed bottom offset');
});

test('the team panel keeps the avatar rings: padding for the box-shadow ring, horizontal overflow clipped', () => {
  const css = read('public/css/screens/game.css');
  const start = css.indexOf('.team {');
  const block = css.slice(start, start + 600);
  assert.match(block, /padding: \.08rem/, 'room for the ring');
  assert.match(block, /overflow-x: clip/, 'a ring outside the row is clipped, not scrolled');
  assert.match(block, /left: \.14rem/, 'left compensated for the padding');
  assert.match(block, /top: 2\.28rem/, 'top compensated for the padding');
  assert.match(block, /overflow-y: auto/, '8 seats still scroll');
});
