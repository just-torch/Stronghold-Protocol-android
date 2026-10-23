// public/js/render/finishWindow.js — the presentation-only "finishing window" after a battle's last snapshot.
//
// A battle stops producing snapshots the moment it finishes (the runner emits its last frame, then `result`; the server
// stops its field and keeps a COMBAT_END pause before SETTLE). The render clock then runs out of buffered snapshots and
// clamps a fraction of a game second past the newest one, so every effect drawn on it — the official VFX layer
// (render/vfx), projectiles, hit animations — froze mid-flight while the result box was still on its way. The battlefield
// still shows the last frame for ~1.5 s (server/match/match/common.js DELAYS.COMBAT_END), so the freeze read as "the
// attack just stops".
//
// This window is a real-time clock for the effect layers only: when the view is told the battle on screen ended
// (`view.holdBattleEnd()`, screens/game.js from the local runner's `result` or m.public.fields[].live === false), the
// effect clock keeps advancing at the battle's rate for FINISH_HOLD_MS real milliseconds past the frozen render clock.
// Sim state, damage, results and the server's settlement are untouched: the app only feeds the effect systems a larger
// game-time delta; nothing here is read by server/sim or sent to the server.
//
// Positions still come from the last snapshot (the render clock does not extrapolate further), so units hold their
// places while their effects play out — the shot in the air lands, the hit animation completes, then the result box
// (phase SETTLE, ≥ DELAYS.COMBAT_END later) takes over.

/** How long (real ms) the effect layers keep playing after the battle on screen ends. */
export const FINISH_HOLD_MS = 1500;

/**
 * The window's timing. `arm` is idempotent: the first end signal starts it, a later one (the phase SETTLE after the
 * runner's `result`, a repeated m.public) neither extends it nor restarts it.
 */
export class FinishWindow {
  constructor(holdMs = FINISH_HOLD_MS) {
    this.holdMs = Number.isFinite(holdMs) && holdMs > 0 ? holdMs : FINISH_HOLD_MS;
    this.reset();
  }

  /** Back to "no battle ended yet" (a new battle entered, the view rebuilt). */
  reset() {
    this.armedAt = null;
    this.baseT = null;
    return this;
  }

  /** Start the window at real time `nowMs` (performance.now()). Returns whether this call started it. */
  arm(nowMs) {
    if (this.armedAt != null) return false;
    const t = Number(nowMs);
    if (!Number.isFinite(t)) return false;
    this.armedAt = t;
    this.baseT = null;
    return true;
  }

  /** Whether the window is still open at real time `nowMs`. */
  holding(nowMs) {
    const now = Number(nowMs);
    return this.armedAt != null && Number.isFinite(now) && now - this.armedAt < this.holdMs;
  }

  /** Whether the window was armed at all (its end included — the effect clock then freezes again). */
  get armed() { return this.armedAt != null; }

  /**
   * The game-time clock to advance the effect layers with. Outside the window it is the render clock itself; while the
   * window is open it runs at `rate` game seconds per real second from the render time seen when it opened, never behind
   * `renderT` (the final snapshots may still be catching up as the end signal arrives). Once the window is over the
   * render clock is returned again, so the caller's delta clamps to 0 and the effects freeze for the settlement.
   *
   * @param {number} nowMs real time (performance.now())
   * @param {number} renderT the render clock's game time (SnapshotBuffer.renderT)
   * @param {number} rate game seconds per real second (SnapshotBuffer.rate, ≈ 2)
   * @returns {number} game time for ofx / plugin effects
   */
  effectClock(nowMs, renderT, rate) {
    const r = Number(renderT);
    if (this.armedAt == null || !Number.isFinite(r)) return r;
    const now = Number(nowMs);
    if (!Number.isFinite(now)) return r;
    const elapsed = now - this.armedAt;
    if (elapsed < 0 || elapsed >= this.holdMs) return r;
    if (this.baseT == null) this.baseT = r;
    const rr = Number(rate);
    const gain = (Number.isFinite(rr) && rr > 0 ? rr : 1) * elapsed / 1000;
    return Math.max(r, this.baseT + gain);
  }
}
