// §21.33 — the debug console panel in a browser, through the mock harness (public/dev/game-mock.html) in headless
// Chrome. Opt-in: SP_E2E=1.
//
//   $env:SP_E2E='1'; $env:CHROME_PATH='…\msedge.exe'; node --test test/ui/console.e2e.test.js
//
//   * the corner button (the terminal glyph, next to ⚙ / 📖) and the ` key open the panel; without `m.private.console`
//     neither exists and the key does nothing (variant=noconsole) — the panel is the server's grant, not a client mode
//   * 干员: search a name, click 获得 → the harness gets exactly one `g.dbgChess` with that id and the operator lands in
//     the 整备区; 精锐 grants the elite id
//   * 装备: the command line (`item …` + Enter) sends `g.dbgItem` and the item lands in the 整备区
//   * 资源: +20 / 归零 send `g.dbgFunds` and the status line + the game follow; the level stepper sends `g.dbgLevel`
//   * 盟约: +10 / 设为 send `g.dbgLayers` with the clamped value and the row's 层 follows
//   * the panel fits the viewport at 1920×1080, 844×390 and 756×366 (the tab bar, the search field, the rows, the command
//     line and the log are all inside the box; the list is the part that scrolls)
// Screenshots: test/e2e/out/dbg-*.png.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'test/e2e/out');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ENABLED = process.env.SP_E2E === '1' && existsSync(CHROME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('debug console (mock harness, headless Chrome)', { skip: !ENABLED && 'set SP_E2E=1 (and have Chrome) to run' }, () => {
  let srv;
  let browser;
  let base;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    base = `http://127.0.0.1:${srv.port}`;
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
    mkdirSync(OUT, { recursive: true });
  });

  after(async () => {
    await browser?.close();
    await srv?.close();
  });

  async function open(query = '', { w = 1920, h = 1080, touch = false } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    // a cold mock-harness page pulls the whole client + data (and, with a cold file cache, several hundred assets): the
    // default 30 s navigation timeout is not enough on a busy machine, so this suite waits longer before measuring
    await page.goto(`${base}/dev/game-mock.html?shot=1&phase=PREP${query ? `&${query}` : ''}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForFunction(() => !!document.querySelector('.screen:not(.gload)') && !!globalThis.__SP_VIEW__ && !!globalThis.__MOCK__, { timeout: 20000 });
    await sleep(1500);
    return { page, problems };
  }

  /** The harness' private view (the mock server state the panel drives). */
  const mockPriv = (page) => page.evaluate(() => {
    const p = globalThis.__MOCK__.S().priv;
    return { funds: p.funds, level: p.shop.level, slots: p.shop.slots.length, hand: p.hand.filter(Boolean).map((x) => x.id), layers: { ...globalThis.__MOCK__.S().layers } };
  });
  /** The requests the panel sent (type + fields). */
  const requests = (page, t) => page.evaluate((type) => globalThis.__MOCK__.S().requests.filter(([x]) => x === type).map(([, f]) => f), t);
  const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() || null, sel);

  test('§21.33: the corner button and ` open the panel — and without the server grant neither exists', async () => {
    const { page, problems } = await open();
    assert.ok(await page.$('.gm__dbg'), 'the corner button');
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.gm__dbg');
      const s = b.querySelector('svg.icon').getBoundingClientRect();
      const r = b.getBoundingClientRect();
      return { label: b.getAttribute('aria-label'), title: b.getAttribute('title'), keys: b.getAttribute('aria-keyshortcuts'), w: s.width, h: s.height, bw: r.width };
    });
    assert.equal(btn.label, '调试控制台');
    assert.match(btn.title, /`/);
    assert.equal(btn.keys, '`');
    assert.ok(Math.abs(btn.w - btn.h) < 0.01 && btn.w >= 0.45 * btn.bw, `the terminal glyph is square (${btn.w}×${btn.h} in ${btn.bw})`);
    assert.equal(await page.$('.dbg'), null, 'closed at first');
    await page.keyboard.press('Backquote');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    assert.match(await text(page, '.modal__title'), /调试控制台/);
    assert.equal(await page.$$eval('.dbg__item', (r) => r.length > 0), true, 'the 干员 rows are up');
    await page.screenshot({ path: path.join(OUT, 'dbg-panel-1920x1080.png') });
    await page.keyboard.press('Backquote');
    await sleep(300);
    assert.equal(await page.$('.dbg'), null, '` closes it again');
    await page.keyboard.press('Backquote');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    await page.keyboard.press('Escape');
    await sleep(300);
    assert.equal(await page.$('.dbg'), null, 'Esc closes it too');
    // the backdrop closes it, and it is a light one (the game behind stays readable — no shared-modal blur)
    await page.keyboard.press('Backquote');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    const backdrop = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.modal.dbgwrap'));
      return { bg: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter, keysBlocked: !!document.querySelector('.modal') };
    });
    assert.equal(backdrop.blur, 'none', `no blur behind the panel (${JSON.stringify(backdrop)})`);
    assert.match(backdrop.bg, /rgba\(3, 5, 4, 0\.3/, 'a light dim');
    assert.ok(backdrop.keysBlocked, 'the outer div is a .modal: the game keys stay blocked');
    await page.mouse.click(4, 4);
    await sleep(300);
    assert.equal(await page.$('.dbg'), null, 'a press on the backdrop closes it');
    assert.deepEqual(problems, []);
    await page.close();

    const no = await open('variant=noconsole');
    assert.equal(await no.page.$('.gm__dbg'), null, 'no button without m.private.console');
    await no.page.keyboard.press('Backquote');
    await sleep(400);
    assert.equal(await no.page.$('.dbg'), null, 'and the key does nothing');
    assert.deepEqual(no.problems, []);
    await no.page.close();
  });

  test('§21.33: 干员 — a search plus 获得 grants that operator (精锐 grants the elite id)', async () => {
    const { page, problems } = await open();
    await page.click('.gm__dbg');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    await page.type('.dbg__search', '银灰');
    await sleep(400);
    const rows = await page.$$eval('.dbg__item .dbg__name', (n) => n.map((x) => x.textContent));
    assert.ok(rows.length >= 1 && rows.every((r) => r.includes('银灰')), `filtered to 银灰 (${rows.join(' / ')})`);
    const before = await mockPriv(page);
    await page.click('.dbg__item .dbg__ops .btn--primary');
    await page.waitForFunction((n) => globalThis.__MOCK__.S().priv.hand.filter(Boolean).length === n + 1, { timeout: 3000 }, before.hand.length);
    const sent = await requests(page, 'g.dbgChess');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].chessId, 'chess_char_4_22_a', 'the base record of the search hit');
    const after = await mockPriv(page);
    assert.ok(after.hand.includes('chess_char_4_22_a'), `in the 整备区 (${after.hand.join(',')})`);
    assert.match(await text(page, '.dbg__log'), /获得干员 银灰/);
    assert.match(await text(page, '.dbg__status'), new RegExp(`整备区 ${after.hand.length}/10`), 'the status line follows m.private');
    // 精锐: the same row's second button sends the elite id
    await page.click('.dbg__item .dbg__ops .btn--secondary');
    await page.waitForFunction(() => globalThis.__MOCK__.S().priv.hand.some((x) => x && x.id === 'chess_char_4_22_b'), { timeout: 3000 });
    const sent2 = await requests(page, 'g.dbgChess');
    assert.equal(sent2.length, 2);
    assert.equal(sent2[1].chessId, 'chess_char_4_22_b');
    assert.match(await text(page, '.dbg__log'), /获得干员 银灰（精锐）/);
    await page.screenshot({ path: path.join(OUT, 'dbg-chess.png') });
    assert.deepEqual(problems, []);
    await page.close();
  });

  test('§21.33: 装备 — the command line sends g.dbgItem, and a bad line stays local', async () => {
    const { page, problems } = await open();
    await page.click('.gm__dbg');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    await page.click('.tabs__tab:nth-child(2)');
    await sleep(200);
    assert.ok(await page.$('.dbg__search'), 'the 装备 tab has its own list');
    const itemName = await page.$eval('.dbg__item .dbg__name', (n) => n.textContent.trim());
    await page.click('.dbg__input');
    await page.type('.dbg__input', 'nope 1');
    await page.keyboard.press('Enter');
    await sleep(400);
    assert.match(await text(page, '.dbg__log'), /未知命令/, 'a bad command never leaves the panel');
    assert.deepEqual(await requests(page, 'g.dbgItem'), []);
    await page.type('.dbg__input', `item ${itemName}`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => globalThis.__MOCK__.S().requests.some(([t]) => t === 'g.dbgItem'), { timeout: 3000 });
    const sent = await requests(page, 'g.dbgItem');
    assert.equal(sent.length, 1);
    const afterItem = await mockPriv(page);
    assert.ok(afterItem.hand.includes(sent[0].itemId), `the item is in the 整备区 (${afterItem.hand.join(',')})`);
    assert.match(await text(page, '.dbg__log'), /获得装备/);
    // the 非商店 toggle widens the list (the odd items come in)
    const n0 = await page.$$eval('.dbg__item', (r) => r.length);
    await page.click('.dbg__odd');
    await sleep(300);
    const n1 = await page.$$eval('.dbg__item', (r) => r.length);
    assert.ok(n1 > n0, `非商店 items listed (${n0} → ${n1})`);
    assert.ok((await page.$$eval('.dbg__item .dbg__tag', (t) => t.some((x) => x.textContent === '非商店'))), 'and tagged');
    assert.deepEqual(problems, []);
    await page.close();
  });

  test('§21.33: 资源 — 资金 and the shop level are set outright', async () => {
    const { page, problems } = await open();
    await page.click('.gm__dbg');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    await page.click('.tabs__tab:nth-child(3)');
    await sleep(200);
    const before = await mockPriv(page);
    await page.click('.dbg__row .btn--primary'); // +1
    await page.waitForFunction((f) => globalThis.__MOCK__.S().priv.funds === f + 1, { timeout: 3000 }, before.funds);
    await page.click('.dbg__row .btn--primary:nth-of-type(3)'); // +20
    await sleep(600);
    const funds = (await mockPriv(page)).funds;
    assert.ok(funds > before.funds, `funds grew (${before.funds} → ${funds})`);
    assert.match(await text(page, '.dbg__status'), new RegExp(`资金 ${funds}`));
    const sent = await requests(page, 'g.dbgFunds');
    assert.ok(sent.every((f) => Number.isInteger(f.funds) && f.funds >= 0), JSON.stringify(sent));
    // the level stepper: 满级 sends the mode's max and the slot count follows
    await page.evaluate(() => [...document.querySelectorAll('.dbg__field')].find((f) => f.textContent.includes('调度中心')).querySelector('.btn--primary').click());
    await page.waitForFunction(() => globalThis.__MOCK__.S().priv.shop.level === 6, { timeout: 3000 });
    const lv = await mockPriv(page);
    assert.equal(lv.level, 6);
    assert.deepEqual((await requests(page, 'g.dbgLevel')).at(-1), { level: 6 });
    assert.ok(lv.slots >= 5, `${lv.slots} shop slots at level 6`);
    assert.match(await text(page, '.dbg__status'), /等级 6/);
    await page.screenshot({ path: path.join(OUT, 'dbg-res.png') });
    assert.deepEqual(problems, []);
    await page.close();
  });

  test('§21.33: 盟约 — the ± steps and 设为 send the clamped layers and the row follows', async () => {
    const { page, problems } = await open();
    await page.click('.gm__dbg');
    await page.waitForSelector('.dbg', { timeout: 3000 });
    await page.click('.tabs__tab:nth-child(4)');
    await sleep(300);
    // the harness' own bond list (m.private.bonds: the bonds its board members carry) — the panel lists those rows
    const listed = await page.evaluate(() => [...globalThis.__MOCK__.S().priv.bonds].map((b) => ({ bondId: b.bondId, layers: b.layers })));
    assert.ok(listed.length > 0, 'the harness has bonds');
    const before = await page.$eval('.dbg__item--bond .dbg__value', (e) => Number(e.textContent.replace(/[^\d]/g, '')));
    await page.click('.dbg__item--bond .dbg__ops--bond button:nth-of-type(4)'); // +10
    await page.waitForFunction((n) => globalThis.__MOCK__.S().requests.some(([t, f]) => t === 'g.dbgLayers' && f.layers === n), { timeout: 3000 }, before + 10);
    const sent = await requests(page, 'g.dbgLayers');
    assert.deepEqual(sent.map((f) => f.layers), [before + 10], 'one +10 step');
    assert.equal(await page.$eval('.dbg__item--bond .dbg__value', (e) => Number(e.textContent.replace(/[^\d]/g, ''))), before + 10, 'the row follows');
    assert.equal((await mockPriv(page)).layers[sent[0].bondId], before + 10, 'the state the server would keep');
    // 设为: the panel clamps the typed value to the official 999 before it sends anything
    await page.type('.dbg__item--bond .dbg__num', '99999');
    await page.click('.dbg__item--bond .dbg__ops--bond .btn--primary');
    await page.waitForFunction(() => globalThis.__MOCK__.S().requests.filter(([t]) => t === 'g.dbgLayers').length === 2, { timeout: 3000 });
    const sent2 = await requests(page, 'g.dbgLayers');
    assert.equal(sent2[1].layers, 999, 'clamped to the official cap');
    assert.match(await page.$eval('.dbg__item--bond .dbg__value', (e) => e.textContent), /999/);
    await page.screenshot({ path: path.join(OUT, 'dbg-bonds.png') });
    assert.deepEqual(problems, []);
    await page.close();
  });

  test('§21.33: the panel fits the viewport (desktop and phone landscape)', async () => {
    for (const [name, w, h, touch] of [['1920x1080', 1920, 1080, false], ['844x390', 844, 390, true], ['756x366', 756, 366, true]]) {
      const { page, problems } = await open('variant=console', { w, h, touch });
      await page.waitForSelector('.dbg', { timeout: 5000 });
      const box = await page.evaluate(() => {
        const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1) }; };
        const list = document.querySelector('.dbg__list');
        const log = document.querySelector('.dbg__log');
        const lines = [...log.querySelectorAll('.dbg__logline')].map((l) => l.getBoundingClientRect());
        return {
          box: (() => { const r = document.querySelector('.dbgbox').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }; })(),
          tabs: q('.dbg__bar .tabs'), search: q('.dbg__search'), list: q('.dbg__list'), cmd: q('.dbg__cmd'), log: q('.dbg__log'),
          scrolls: list.scrollHeight > list.clientHeight + 1,
          last: lines.length ? { top: +lines[lines.length - 1].top.toFixed(1), bottom: +lines[lines.length - 1].bottom.toFixed(1) } : null,
          rows: document.querySelectorAll('.dbg__item').length,
          vw: globalThis.innerWidth, vh: globalThis.innerHeight,
        };
      });
      assert.ok(box.box.y >= -0.5 && box.box.b <= box.vh + 0.5, `${name}: the box is inside the viewport (${JSON.stringify(box.box)} of ${box.vh})`);
      for (const part of ['tabs', 'search', 'list', 'cmd', 'log']) {
        assert.ok(box[part], `${name}: ${part} exists`);
        assert.ok(box[part].y >= box.box.y - 1 && box[part].b <= box.box.b + 1, `${name}: ${part} inside the box (${JSON.stringify(box[part])})`);
      }
      assert.ok(box.list.h > (name === '1920x1080' ? 100 : 40), `${name}: the list has room (${box.list.h} px)`);
      assert.ok(box.rows > 5, `${name}: rows are drawn (${box.rows})`);
      assert.ok(box.log.h > 10, `${name}: the log line is visible`);
      assert.ok(box.last && box.last.bottom <= box.log.b + 1, `${name}: the newest log line is inside the log (${JSON.stringify(box.last)} of ${JSON.stringify(box.log)})`);
      assert.deepEqual(problems, [], name);
      // `help` fills the log: it renders newest-first, so the line a click just produced is always the visible one and
      // a short (phone-height) log clips an OLD line at the bottom instead
      await page.click('.dbg__input');
      await page.type('.dbg__input', 'help');
      await page.keyboard.press('Enter');
      await sleep(500);
      const lines = () => page.evaluate(() => {
        const log = document.querySelector('.dbg__log').getBoundingClientRect();
        const l = [...document.querySelectorAll('.dbg__logline')].map((x) => x.getBoundingClientRect());
        const at = (i) => ({ top: +l[i].top.toFixed(1), bottom: +l[i].bottom.toFixed(1) });
        return { top: +log.top.toFixed(1), bottom: +log.bottom.toFixed(1), count: l.length, newest: at(0), oldest: at(l.length - 1), firstText: document.querySelector('.dbg__logline').textContent };
      });
      const full = await lines();
      assert.ok(full.count >= 4, `${name}: the help filled the log (${full.count} lines)`);
      assert.match(full.firstText, /help/, `${name}: the newest line is the first one`);
      assert.ok(full.newest.top >= full.top - 1 && full.newest.bottom <= full.bottom + 1, `${name}: the newest line is fully visible (${JSON.stringify(full)})`);
      await page.evaluate(() => { document.querySelector('.dbg__log').style.maxHeight = '40px'; });
      await sleep(150);
      const short = await lines();
      assert.ok(short.newest.top >= short.top - 1 && short.newest.bottom <= short.bottom + 1, `${name}: the newest line stays whole at a short height (${JSON.stringify(short)})`);
      assert.ok(short.oldest.bottom > short.bottom + 1, `${name}: …and an old line is the one clipped (${JSON.stringify(short)})`);
      await page.screenshot({ path: path.join(OUT, `dbg-fit-${name}.png`) });
      assert.deepEqual(problems, [], name);
      await page.close();
    }
  });
});
