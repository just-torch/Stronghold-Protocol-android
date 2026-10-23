// test/render/finish-window.test.js — the presentation-only finishing window (render/finishWindow.js) that keeps a
// battle's effect layers playing after its last snapshot (the render clock clamps ~0.1 s past the newest snapshot, so
// official VFX / projectiles used to freeze mid-flight). Pure timing, no PIXI, no sim: the window only feeds a larger
// game-time delta to the effect systems; it never changes a snapshot, damage or a result.
// Run: node --test test/render/finish-window.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FinishWindow, FINISH_HOLD_MS } from '../../public/js/render/finishWindow.js';
import { SnapshotBuffer } from '../../public/js/render/interp.js';

const close = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test('the window holds 1–1.5 real seconds (the server\'s COMBAT_END pause is 1.5 s)', () => {
  assert.ok(FINISH_HOLD_MS >= 1000 && FINISH_HOLD_MS <= 1500, `${FINISH_HOLD_MS} ms`);
  assert.equal(new FinishWindow().holdMs, FINISH_HOLD_MS);
  assert.equal(new FinishWindow(0).holdMs, FINISH_HOLD_MS, 'an invalid duration falls back');
});

test('not armed: the effect clock is the render clock', () => {
  const w = new FinishWindow(1000);
  assert.equal(w.armed, false);
  assert.equal(w.holding(0), false);
  assert.equal(w.effectClock(12345, 42, 2), 42);
});

test('armed: the effect clock runs at the battle rate past the frozen render clock, then freezes again', () => {
  const w = new FinishWindow(1000);
  const renderT = 100;                          // frozen: no snapshots after the battle ended
  assert.equal(w.arm(5000), true);
  assert.equal(w.armed, true);
  assert.ok(w.holding(5000) && w.holding(5999));
  close(w.effectClock(5000, renderT, 2), renderT, 'starts at the render clock');
  close(w.effectClock(5500, renderT, 2), renderT + 1, '0.5 s real × 2 = 1 game s');
  close(w.effectClock(5999, renderT, 2), renderT + 1.998, 'just before the end');
  assert.equal(w.holding(6000), false, 'the window is over at exactly the hold');
  assert.equal(w.effectClock(6000, renderT, 2), renderT, 'afterwards the render clock (its delta clamps to 0)');
  assert.equal(w.effectClock(9000, renderT, 2), renderT);
});

test('the first end signal wins: a second arm (the later SETTLE) neither extends nor restarts the window', () => {
  const w = new FinishWindow(1000);
  assert.equal(w.arm(1000), true);
  close(w.effectClock(1500, 10, 2), 11);
  assert.equal(w.arm(4000), false, 'already armed');
  assert.equal(w.holding(4500), false, 'not extended by the second arm');
  assert.equal(w.effectClock(1500, 10, 2), 11, 'the clock is unchanged by the ignored arm');
});

test('never behind the render clock: catching-up snapshots win; a missing / zero rate falls back to 1×', () => {
  const w = new FinishWindow(1000);
  w.arm(0);
  close(w.effectClock(100, 10, 2), 10.2);
  assert.equal(w.effectClock(200, 20, 2), 20, 'the render clock is ahead (a late snapshot arrived)');
  const slow = new FinishWindow(1000);
  slow.arm(0);
  close(slow.effectClock(500, 10, 0), 10.5, 'rate 0 → 1 game s per real s');
  close(slow.effectClock(500, 10, NaN), 10.5, 'NaN rate → 1×');
});

test('reset lets the next battle arm its own window; a non-finite arm time is ignored', () => {
  const w = new FinishWindow(1000);
  assert.equal(w.arm(NaN), false);
  assert.equal(w.arm(0), true);
  assert.equal(w.holding(500), true);
  w.reset();
  assert.equal(w.armed, false);
  assert.equal(w.holding(500), false);
  assert.equal(w.arm(7000), true, 'a new battle can arm it');
  assert.equal(w.holding(7000), true);
});

test('the freeze it fixes: a stopped snapshot stream pins the render clock; the window keeps the effect clock moving', () => {
  const sb = new SnapshotBuffer({ delay: 0.1, rate: 2 });
  const u = (x) => [1, x, 9, 100, 100, 0, 0, 0, 0];
  sb.push({ t: 0, units: [u(5)] }, 0);
  sb.push({ t: 1, units: [u(5)] }, 0.5);
  sb.push({ t: 2, units: [u(5)] }, 1);          // the battle's last frame
  let renderT = sb.update(1.0);
  for (let now = 1.0; now <= 2.0; now += 1 / 60) renderT = sb.update(now);
  // no further snapshots: the clock sits at (or a hair under) newest + maxExtrapolate × rate and stops
  assert.ok(renderT > 2.1 && renderT <= 2.24 + 1e-9, `the frozen render clock ${renderT.toFixed(4)} ≤ 2.24`);
  close(sb.update(2.1), renderT, 'a second later it has not moved');
  const w = new FinishWindow(1000);
  w.arm(10000);
  close(w.effectClock(10000, renderT, 2), renderT, 'opened at the frozen render clock');
  const at500 = w.effectClock(10500, renderT, 2);
  close(at500, renderT + 1, 'the effect clock moves (0.5 real s × 2)');
  assert.ok(Math.abs(sb.update(2.6) - renderT) < 1e-9, 'the render clock itself stays frozen (positions hold)');
  assert.equal(w.effectClock(11000, renderT, 2), renderT, 'after the window the effect clock freezes again');
});
