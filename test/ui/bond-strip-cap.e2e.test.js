// The bond strip is a capped row, not a scroller (the fork's own layout; the owner asked for the ‹ › arrows and the
// horizontal scrollbar to go on 2026-10-30): the discs up to the cap are drawn, the rest are counted by a +N chip, and
// each disc's ring is the member progress ring (在场人数 / 满档阈值) instead of the tier segments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME, hasChrome } from '../e2e/client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the strip caps its bonds behind +N, has no scroll arrows, and draws the member ring', { skip: process.env.SP_E2E !== '1' || !hasChrome(), timeout: 90000 }, async () => {
  const { startServer } = await import('../../server/index.js');
  const puppeteer = (await import('puppeteer-core')).default;
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  // own profile dir, under the repo rather than %TEMP%: Chrome here cannot take the singleton lock of a temporary one
  mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
  const profile = mkdtempSync(path.join(ROOT, '.cache', 'bond-strip-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [width, height, touch] of [[1920, 1080, false], [844, 390, true]]) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width, height, isMobile: touch, hasTouch: touch });
      await page.goto(srv.url + '/dev/game-mock.html?shot=1&render=fallback&phase=PREP');
      await page.waitForSelector('.bstrip .bond');
      const count = await page.evaluate(async () => {
        const { data } = await import('/js/data.js');
        const mock = globalThis.__MOCK__, state = mock.store.get();
        const bonds = data.list('bonds').map((b, i) => ({ bondId: b.bondId, count: 1, tier: 0, active: false, layers: i }));
        mock.store.set({ match: { ...state.match, private: { ...state.match.private, bonds } } });
        return bonds.length;
      });
      const CAP = 14;
      await page.waitForFunction((n) => document.querySelectorAll('.bslot').length === n, {}, Math.min(count, CAP));
      const shown = await page.evaluate(() => ({
        slots: document.querySelectorAll('.bslot').length,
        more: document.querySelector('.bstrip__more')?.textContent ?? null,
        arrows: document.querySelectorAll('.bstrip-scroll__arrow').length,
        scroller: document.querySelectorAll('.bstrip-scroll').length,
        rings: [...document.querySelectorAll('.bslot .bond__ring')].map((el) => ({
          members: el.classList.contains('bond__ring--members'),
          data: el.getAttribute('data-members'),
          goal: el.getAttribute('data-goal'),
          arc: !!el.querySelector('.arc'),
          segments: el.querySelectorAll('circle.on, circle.off').length,
        })),
      }));
      assert.equal(shown.slots, Math.min(count, CAP), 'the discs up to the cap');
      assert.equal(shown.more, `+${count - Math.min(count, CAP)}`, 'the rest are behind +N');
      assert.equal(shown.arrows, 0, 'no scroll arrows');
      assert.equal(shown.scroller, 0, 'no scroller');
      assert.ok(shown.rings.length >= 1);
      for (const r of shown.rings) {
        assert.ok(r.members && r.arc, 'the ring is the member arc');
        assert.equal(r.segments, 0, 'no tier segments');
        assert.equal(r.data, '1', 'the arc reads the member count');
        assert.ok(Number(r.goal) >= 1, 'the arc is relative to the 满档 threshold (1 for a one-tier bond)');
      }
      // the strip opens the bond popup as before
      await page.click('.bslot:first-child .bond');
      await page.waitForSelector('.bpop');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await srv.close(); rmSync(profile, { recursive: true, force: true }); }
});
