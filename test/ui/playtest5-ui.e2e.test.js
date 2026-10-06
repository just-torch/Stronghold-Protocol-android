// Browser regressions of user playtest #5, UI items 8 / 9, through the mock harness (public/dev/game-mock.html) in
// headless Chrome (puppeteer-core + system Chrome). Opt-in: SP_E2E=1.
//
//   SP_E2E=1 node --test test/ui/playtest5-ui.e2e.test.js
//
//  9  during prep no bench (row 7) / temp (row 8) tile is covered by DOM overlays (the shop bar, the corner buttons, the
//     tools) and the field's back row is free of the bond strip — own board and Final Assault half, at the phone
//     landscape viewports (844×390 and 932×430 with and without the iPhone insets, 915×412, 800×360, 914×411,
//     960×411, 924×424, and the user's Android: 756×366 — its 2772×1272 px screenshot shows the page right of a
//     141 px black cutout band, 2631×1272 px at DPR ≈ 3.48, the exit and 准备就绪 buttons matching to ±1 px — and
//     798×366 with a 41 px left inset had the page covered the cutout) and at desktop 16:9 / 16:10 / 3:2 / 21:9, where
//     the official shop camera is unchanged (122 px per bench tile at 1920×1080). Each tile top's projected quad is
//     sampled on a 24 × 24 grid with elementFromPoint (every HUD element hit-testable); a sample counts as covered
//     when the element there paints (background, border, text, image) — v2.3 left 71 % of bench pads 4–9 free at
//     844×390, 49 % at 800×360 and 54 % at 756×366 (the user's screenshot: pads 3–9 about half covered).
//  9  an armed shop card (first tap of the two-tap buy) at 756×366 rises ≤ 5 px above the bar and covers ≤ 4 px of
//     the bench pads' near corners (accepted, ui/fieldHost.js hudBands)
//  8  the corner's ⚙ is the regular gear glyph (ui/gameComponents.js gearPath), square, as large as 📖 / ⛶ (half the
//     grown button on phones)
//  §21.32 (after 0.1.1, the same strip) the bar's row is one box in every state: the 晋升奖励 offer that replaces the cards
//     mid-prep used to make the row taller than the band the camera had reserved, pushing the bench under the bar — and
//     the board changed size with it ("有人反映有时商店会阻挡场地有时不会"). Measured here at desktop windows (where the
//     offer used to bite: 1400×636, 1920×872, 1920×1080): the row's top and height, the bench's tile size and the free
//     fraction of every bench pad are the same before and after the offer arrives. And C folds the bar: the tab takes
//     its place, the board grows to the official shop-collapsed camera and no bench pad is left under the HUD.
// Screenshots: test/e2e/out/p5-*.png.

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

const IPH = (s) => ({ l: s, r: s, t: 0, b: 21 }); // iPhone landscape safe-area insets (px)
/** name, width, height, touch, insets */
const VIEWS = [
  ['844x390', 844, 390, true, null], ['844x390-notch', 844, 390, true, IPH(47)], ['932x430', 932, 430, true, null],
  ['932x430-notch', 932, 430, true, IPH(59)], ['915x412', 915, 412, true, null], ['800x360', 800, 360, true, null],
  ['914x411', 914, 411, true, null], ['960x411', 960, 411, true, null], ['924x424', 924, 424, true, null],
  ['756x366', 756, 366, true, null], ['798x366-inset41', 798, 366, true, { l: 41, r: 0, t: 0, b: 0 }],
  ['1920x1080', 1920, 1080, false, null], ['1680x1050', 1680, 1050, false, null], ['1560x1040', 1560, 1040, false, null],
  ['2560x1080', 2560, 1080, false, null],
];
const view = (name) => VIEWS.find((v) => v[0] === name);

describe('user playtest #5 — UI items 8 / 9 (mock harness, headless Chrome)', { skip: !ENABLED && 'set SP_E2E=1 (and have Chrome) to run' }, () => {
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

  async function open(query, { w, h, touch, insets }) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    await page.goto(`${base}/dev/game-mock.html?shot=1&${query}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!document.querySelector('.screen:not(.gload)') && !!globalThis.__SP_VIEW__, { timeout: 20000 });
    if (insets) {
      await page.evaluate((i) => {
        const s = document.documentElement.style;
        s.setProperty('--sa-l', `${i.l}px`); s.setProperty('--sa-r', `${i.r}px`); s.setProperty('--sa-t', `${i.t}px`); s.setProperty('--sa-b', `${i.b}px`);
      }, insets);
      await page.evaluate(() => globalThis.__SP_VIEW__.raw.resize());
    }
    await sleep(1800);
    return { page, problems };
  }

  /** Free fraction of each tile top of the listed board tiles (board coordinates; the boss prep maps them itself). */
  const freeFractions = (page, tiles) => page.evaluate((tiles) => {
    const view = globalThis.__SP_VIEW__.raw;
    const st = document.createElement('style');
    st.textContent = '.gm__hud, .gm__hud * { pointer-events: auto !important; }';
    document.head.appendChild(st);
    const clear = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
    const paints = (el) => {
      if (!el || el.tagName === 'CANVAS' || el.closest('.gm__field')) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (['IMG', 'svg', 'path', 'B', 'SPAN', 'KBD', 'I', 'P', 'LABEL'].includes(el.tagName)) return true;
      if (!clear(cs.backgroundColor) || cs.backgroundImage !== 'none') return true;
      if (['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && !clear(cs[`border${s}Color`]))) return true;
      return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    };
    const inside = (poly, x, y) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const out = tiles.map(([r, c]) => {
      const t = view.tileScreen(r, c);
      if (!t) return { r, c, free: -1 };
      const xs = t.poly.map((p) => p[0]), ys = t.poly.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      let n = 0, free = 0;
      const N = 24;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = x0 + (x1 - x0) * (i + 0.5) / N, y = y0 + (y1 - y0) * (j + 0.5) / N;
        if (!inside(t.poly, x, y)) continue;
        n++;
        if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !paints(document.elementFromPoint(x, y))) free++;
      }
      return { r, c, free: n ? free / n : 0, s: t.s };
    });
    st.remove();
    return out;
  }, tiles);

  const BENCH = Array.from({ length: 10 }, (_, c) => [7, c]);
  const TEMP = [4, 5, 6, 7, 8].map((c) => [8, c]);
  const BACK = [4, 5, 6, 7, 8, 9, 10].map((c) => [12, c]); // the playable back row of 战场#01 (cols 0–3: forbidden)

  test('9: bench, temp and the back row are free of the HUD in prep and in the Final Assault prep', { timeout: 10 * 60 * 1000 }, async () => {
    const report = [];
    for (const [name, w, h, touch, insets] of VIEWS) {
      for (const variant of ['', 'boss']) {
        const { page, problems } = await open(`phase=PREP${variant ? `&variant=${variant}` : ''}`, { w, h, touch, insets });
        const tag = `${name}${variant ? ' (Final Assault prep)' : ''}`;
        const bench = await freeFractions(page, BENCH);
        const temp = await freeFractions(page, TEMP);
        const back = await freeFractions(page, BACK);
        for (const t of [...bench, ...temp]) assert.ok(t.free >= 0.99, `${tag}: ${t.r === 7 ? 'bench' : 'temp'} ${t.c} ${Math.round(t.free * 100)} % free`);
        for (const t of back) assert.ok(t.free >= 0.99, `${tag}: back row ${t.c} ${Math.round(t.free * 100)} % free`);
        // desktop 16:9 keeps the official shop camera
        if (name === '1920x1080' && !variant) assert.ok(Math.abs(bench[5].s - 122) < 1, `1920×1080 px per bench tile ${bench[5].s}`);
        report.push(`${tag}: bench ${Math.round(Math.min(...bench.map((t) => t.free)) * 100)} %, ${Math.round(bench[5].s)} px/tile`);
        if (['844x390', '756x366', '800x360', '1920x1080'].includes(name)) await page.screenshot({ path: path.join(OUT, `p5-bench-${name}${variant ? '-boss' : ''}.png`) });
        assert.deepEqual(problems, [], tag);
        await page.close();
      }
    }
    console.log(report.join('\n'));
  });

  test('9: an armed shop card (two-tap buy) barely reaches the bench on the user\'s phone', async () => {
    // accepted overlap (ui/fieldHost.js hudBands): the armed card rises 4 px above the bar at 1rem = 40 px and covers
    // the pads' near corners by ≈ 3 px — less than under the official camera at 1920×1080 (13 px / ≈ 11 px)
    const [, w, h, touch] = view('756x366');
    const { page, problems } = await open('phase=PREP', { w, h, touch });
    const cards = await page.$$('.scard:not(.scard--sold)');
    assert.ok(cards.length > 0, 'a shop card to arm');
    await cards[0].tap();
    await sleep(400);
    const r = await page.evaluate(() => {
      const a = document.querySelector('.scard.is-armed');
      if (!a) return null;
      const b = a.getBoundingClientRect(), row = document.querySelector('.shopbar__row').getBoundingClientRect();
      const view = globalThis.__SP_VIEW__.raw;
      let over = 0;
      for (let c = 0; c < 10; c++) {
        const t = view.tileScreen(7, c);
        const xs = t.poly.map((p) => p[0]), y1 = Math.max(...t.poly.map((p) => p[1]));
        if (Math.max(...xs) > b.left && Math.min(...xs) < b.right) over = Math.max(over, y1 - b.top);
      }
      return { lift: row.top - b.top, over };
    });
    assert.ok(r, 'the first tap arms the card');
    assert.ok(r.lift <= 5, `armed card ${r.lift} px above the bar`);
    assert.ok(r.over <= 4, `armed card over the bench pads by ${r.over} px`);
    assert.deepEqual(problems, []);
    await page.close();
  });

  test('8: the corner gear is the regular glyph, square and as large as its neighbours', async () => {
    const { GLYPHS } = await import('../../public/js/ui/gameComponents.js');
    for (const [name, w, h, touch] of [view('844x390'), view('756x366'), view('1920x1080')]) {
      const { page, problems } = await open('phase=PREP', { w, h, touch });
      const r = await page.evaluate(() => [...document.querySelectorAll('.gm__corner .gm__gear')].map((b) => {
        const svg = b.querySelector('svg.icon');
        const s = svg.getBoundingClientRect(), br = b.getBoundingClientRect();
        return { cls: b.className, w: s.width, h: s.height, bw: br.width, d: svg.querySelector('path')?.getAttribute('d') };
      }));
      // ⚙ 📖 ⛶ and — the harness grants the debug console (§21.33) — the terminal button at the group's right end
      assert.equal(r.length, 4, `${name}: ⚙ 📖 ⛶ + the console's terminal`);
      assert.equal(r[0].d, GLYPHS.gear, `${name}: the gear glyph`);
      assert.ok(r[3].cls.includes('gm__dbg') && r[3].d !== GLYPHS.gear, `${name}: the terminal glyph is last`);
      for (const b of r) {
        assert.ok(Math.abs(b.w - b.h) < 0.01, `${name}: ${b.cls} square (${b.w}×${b.h})`);
        assert.ok(b.w >= 0.45 * b.bw && b.w <= 0.55 * b.bw, `${name}: ${b.cls} icon ${b.w} in a ${b.bw} button`);
      }
      await page.screenshot({ path: path.join(OUT, `p5-corner-${name}.png`), clip: { x: 0, y: h - 90, width: 480, height: 90 } });
      assert.deepEqual(problems, [], name);
      await page.close();
    }
  });

  test('§21.32: the 晋升奖励 offer arriving mid-prep neither moves the bar nor covers the bench', { timeout: 5 * 60 * 1000 }, async () => {
    // The reproduction: `phase=PREP` fits the camera to the operator cards, then the offer replaces them (the player
    // levels up mid-prep; the mock's mutate does what the Switcher's "merge reward" button does). Before the fix the
    // row grew by 9–14 px and pushed the bench pads under it at exactly these window heights — the official framing is
    // fitted to 1080p, and 1400×636 / 1920×872 / 1920×1080 had no slack (1440×900 did).
    const report = [];
    for (const [name, w, h] of [['1400x636', 1400, 636], ['1920x872', 1920, 872], ['1920x1080', 1920, 1080]]) {
      const { page, problems } = await open('phase=PREP', { w, h, touch: false });
      const bar = () => page.evaluate(() => {
        const r = document.querySelector('.shopbar__row').getBoundingClientRect();
        return { top: +r.top.toFixed(2), height: +r.height.toFixed(2) };
      });
      const before = await bar();
      const benchBefore = await freeFractions(page, BENCH);
      await page.evaluate(() => globalThis.__MOCK__.mutate((S) => {
        S.priv.shop.rewardOffer = {
          tier: 5,
          slots: ['chess_char_6_17_a', 'chess_char_4_09_a', 'chess_char_5_04_a'].map((id) => ({ kind: 'chess', id, price: 0, sold: false })),
        };
      }));
      await sleep(900);
      assert.ok(await page.$('.rwtag'), `${name}: the offer banner is up`);
      const after = await bar();
      const benchAfter = await freeFractions(page, BENCH);
      assert.deepEqual(after, before, `${name}: the bar's row is the same box before and after the offer`);
      assert.deepEqual(benchAfter.map((t) => t.s), benchBefore.map((t) => t.s), `${name}: the board is framed the same (no size change)`);
      for (const t of [...benchBefore, ...benchAfter]) assert.ok(t.free >= 0.99, `${name}: bench ${t.c} ${Math.round(t.free * 100)} % free`);
      report.push(`${name}: row ${before.height} px, bench ${Math.round(benchBefore[5].s)} px/tile, free ${Math.round(Math.min(...benchAfter.map((t) => t.free)) * 100)} %`);
      await page.screenshot({ path: path.join(OUT, `p5-reward-${name}.png`) });
      assert.deepEqual(problems, [], name);
      await page.close();
    }
    console.log(report.join('\n'));
  });

  test('§21.32: C folds the shop bar — the tab takes its place, the board grows and the bench stays clear', { timeout: 5 * 60 * 1000 }, async () => {
    for (const [name, w, h, touch] of [['1400x636', 1400, 636, false], ['756x366', 756, 366, true]]) {
      const { page, problems } = await open('phase=PREP', { w, h, touch });
      const unfolded = await freeFractions(page, BENCH);
      await page.keyboard.press('c');
      await sleep(1200);
      assert.ok(await page.$('.shopbar-tab'), `${name}: the folded tab`);
      assert.equal(await page.$('.shopbar'), null, `${name}: the full bar is gone`);
      const folded = await freeFractions(page, BENCH);
      for (const t of folded) assert.ok(t.free >= 0.99, `${name}: bench ${t.c} ${Math.round(t.free * 100)} % free while folded`);
      // the official shop-collapsed camera (public issue #5) is a bigger board — the bench pads included
      assert.ok(folded[5].s > unfolded[5].s * 1.05, `${name}: ${unfolded[5].s} → ${folded[5].s} px per bench tile`);
      await page.screenshot({ path: path.join(OUT, `p5-fold-${name}.png`) });
      await page.keyboard.press('c');
      await sleep(1200);
      assert.ok(await page.$('.shopbar'), `${name}: C unfolds it again`);
      assert.equal(await page.$('.shopbar-tab'), null, `${name}: the tab is gone`);
      assert.deepEqual(problems, [], name);
      await page.close();
    }
  });

  test('§21.38: the count badge leaves the disc, the glyph and the tier ring alone', { timeout: 5 * 60 * 1000 }, async () => {
    // The report after §21.35: "继续调大盟约图标，现在图标仍被激活人数挡住". The corner chip of a disc that fills its slot
    // cannot but cover it (measured before the fix: 8.0 % of the face, 10.2 % of the ring and 2.65 % of the glyph at
    // 1rem = 40 px). The badge rides above the tier ring now, so every part of the disc is free at every size — sampled
    // here over the face's circle, the glyph's circle and the ring's annulus, with the badge's own box as the mask.
    const report = [];
    for (const [name, w, h, touch] of [view('1920x1080'), ['1440x900', 1440, 900, false], view('844x390'), view('915x412'), view('756x366')]) {
      const { page, problems } = await open('phase=PREP', { w, h, touch });
      const r = await page.evaluate(() => {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const R = (el) => el.getBoundingClientRect();
        // the top bar's boxes that actually paint something (the same predicate the free-fraction sweep uses): the
        // transparent containers (.gtop__left spans a whole grid column) are not what "covering the top bar" means
        const clear = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
        const paints = (el) => {
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
          if (['IMG', 'svg', 'path', 'B', 'SPAN', 'KBD', 'I', 'P', 'LABEL'].includes(el.tagName)) return true;
          if (!clear(cs.backgroundColor) || cs.backgroundImage !== 'none') return true;
          if (['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && !clear(cs[`border${s}Color`]))) return true;
          return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        };
        const bars = [...document.querySelectorAll('.gtop, .gtop *')].filter(paints).map(R).filter((b) => b.width > 1 && b.height > 1);
        const slots = [...document.querySelectorAll('.gm__bonds .bslot')].map((s) => {
          const core = R(s.querySelector('.bond__core'));
          const disc = R(s.querySelector('.bond__disc'));
          const gl = s.querySelector('.bond__icon, .bond__glyph');
          const chip = R(s.querySelector('.bslot__count'));
          const cx = core.left + core.width / 2; const cy = core.top + core.height / 2;
          const faceR = core.width / 2;
          const glyphR = gl ? Math.min(R(gl).width, R(gl).height) / 2 : 0;
          // .bond__ring: r = 46 of a 100-unit viewBox in a box of 120 % of --disc → its outer edge is at .582 of the disc
          const ringR = disc.width * 0.582;
          const cover = (rIn, rOut) => {
            let n = 0; let k = 0; const N = 80;
            for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
              const x = cx - rOut + (2 * rOut * (i + 0.5)) / N; const y = cy - rOut + (2 * rOut * (j + 0.5)) / N;
              const d = Math.hypot(x - cx, y - cy);
              if (d > rOut || d < rIn) continue;
              n++;
              if (x >= chip.left && x <= chip.right && y >= chip.top && y <= chip.bottom) k++;
            }
            return n ? k / n : 0;
          };
          let over = 0;
          for (const b of bars) {
            const ox = Math.min(chip.right, b.right) - Math.max(chip.left, b.left);
            const oy = Math.min(chip.bottom, b.bottom) - Math.max(chip.top, b.top);
            if (ox > 0 && oy > 0) over = Math.max(over, ox * oy);
          }
          return { bond: s.getAttribute('data-bond'), count: s.querySelector('.bslot__count').textContent.trim(),
            disc: disc.width, face: cover(0, faceR), glyph: glyphR ? cover(0, glyphR) : 0, ring: cover(faceR, ringR),
            bars: over, lift: core.top - chip.bottom };
        });
        return { rem, slots };
      });
      const want = touch && h <= 460 ? 0.62 : 0.68;
      assert.ok(r.slots.length > 0, `${name}: bond discs`);
      for (const s of r.slots) {
        assert.equal(s.face, 0, `${name}: ${s.bond} ${s.count} — the badge covers ${(s.face * 100).toFixed(1)} % of the disc's face`);
        assert.equal(s.glyph, 0, `${name}: ${s.bond} — the badge covers ${(s.glyph * 100).toFixed(2)} % of the glyph`);
        assert.equal(s.ring, 0, `${name}: ${s.bond} — the badge covers ${(s.ring * 100).toFixed(1)} % of the tier ring`);
        assert.equal(s.bars, 0, `${name}: ${s.bond} — the badge overlaps the top bar by ${s.bars.toFixed(1)} px²`);
        assert.ok(Math.abs(s.disc - want * r.rem) < 0.5, `${name}: ${s.bond} disc ${s.disc} px (--bslot-disc ${want}rem of ${r.rem})`);
        // the lift is the CSS's .12 of the disc; the ring's own overhang is .082, so this must hold with room to spare
        assert.ok(s.lift > 0.1 * s.disc, `${name}: ${s.bond} — the badge sits ${s.lift.toFixed(2)} px above the disc (${s.disc} px)`);
      }
      report.push(`${name}: ${r.slots.length} discs of ${(r.slots[0].disc).toFixed(1)} px, face/glyph/ring covered 0 %, lift ${r.slots[0].lift.toFixed(1)} px`);
      await page.screenshot({ path: path.join(OUT, `p5-bonds-${name}.png`), clip: { x: 0, y: 0, width: Math.min(w, 700), height: Math.min(h, 200) } });
      assert.deepEqual(problems, [], name);
      await page.close();
    }
    console.log(report.join('\n'));
  });
});
