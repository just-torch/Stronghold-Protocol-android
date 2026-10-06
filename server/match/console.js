// server/match/console.js — the debug console's server side (DESIGN §21.33).
//
// A test tool, not gameplay: the five `g.dbg*` intents (shared/protocol.js) let a tester who was granted the console
// put the match into the state he wants to look at, without playing the rounds that would get there:
//
//   g.dbgChess { chessId }   grant a copy of ANY chess record — the shared pool is not consulted (a copy taken when one
//                            is left, an out-of-pool / hidden / banned operator is created holding 0 copies, exactly
//                            like an effect grant with the pool empty: pool.js), merges and hand/temp overflow apply as
//                            for any other gain (PlayerState.acquireChess), so a third copy still merges to the elite
//   g.dbgItem  { itemId }    grant an item (PlayerState.acquireItem: a second identical normal item merges)
//   g.dbgFunds { funds }     set 资金 outright (0 … CONSOLE_LIMITS.funds); no stats are touched
//   g.dbgLayers { bondId, layers }
//                            set one bond's 盟约层数 outright (0 … BOND_LAYER_CAP, 0 forgets the bond). A direct write:
//                            no onLayers — a tester sets a state, he does not play a gain, so layer-特质 do not react
//                            (the same reason the settling writers go through addLayers instead)
//   g.dbgLevel { level }     set the 调度中心 level (1 … the mode's maxShopLevel) and re-roll the shop for the slot
//                            count that level has (frozen, unsold slots survive — rollShop keepFrozen, like round start)
//
// WHO may: the seat's `console` flag, decided by the connection in server/lobby.js (`consoleAllowed`: a loopback client,
// or every client under SP_CONSOLE=1) — never by anything the client says. Everyone else gets ERR.NO_CONSOLE, so a
// hosted game has no console at all. The console ignores 准备就绪 (a tester fixes the state he is looking at); it is
// refused once the player is eliminated or the match has ended (nothing left to inspect or to change).
//
// Every op is a thin wrapper around the PlayerState API the game itself uses, so the invariants (hand/temp overflow,
// pool copies, merges, deploy legality through recompute) hold for console-made state too: a test may be unreal, the
// state it produces is not. Docs: docs/DESIGN.md §21.33 (model), docs/PLAYING.md (the player-facing panel),
// tests: test/match/console.test.js (the ops and the guard), test/ui/console.test.js (the panel's model).

import { BOND_LAYER_CAP, ERR } from '../../shared/constants.js';

const OK = Object.freeze({ ok: true });
const fail = (error, detail) => (detail ? { error, detail } : { error });

/** The `g.dbg*` message types this module owns (Match._handle's default branch). */
export const CONSOLE_TYPES = Object.freeze(['g.dbgChess', 'g.dbgItem', 'g.dbgFunds', 'g.dbgLayers', 'g.dbgLevel']);

/** @param {string} t */
export const isConsoleType = (t) => CONSOLE_TYPES.includes(t);

/** An id as it can appear in a log line / error detail (never throws on junk). */
const short = (v) => String(v).slice(0, 64);

/**
 * Run one console intent. The caller (Match._handle) has already validated the message's shape.
 * @param {import('./Match.js').Match} m
 * @param {import('./PlayerState.js').PlayerState} ps
 * @param {{ t: string }} msg
 * @returns {{ ok: true } | { error: string, detail?: string }}
 */
export function runConsole(m, ps, msg) {
  if (!ps || !ps.console) return fail(ERR.NO_CONSOLE);
  if (m.ended || m.disposed) return fail(ERR.WRONG_PHASE, 'match over');
  if (!ps.alive) return fail(ERR.ELIMINATED);
  switch (msg.t) {
    case 'g.dbgChess': return dbgChess(m, ps, msg.chessId);
    case 'g.dbgItem': return dbgItem(m, ps, msg.itemId);
    case 'g.dbgFunds': return dbgFunds(m, ps, msg.funds);
    case 'g.dbgLayers': return dbgLayers(m, ps, msg.bondId, msg.layers);
    case 'g.dbgLevel': return dbgLevel(m, ps, msg.level);
    default: return fail(ERR.BAD_MSG);
  }
}

/** Log one console use (the host's log is the record of what a test did). */
function logged(m, ps, text) {
  m.log.info?.(`[match ${m.roomCode}] console ${ps.playerId}: ${text}`);
}

/** Grant a chess copy of any record (normal or elite id). HAND_FULL when hand and temp are both full. */
export function dbgChess(m, ps, chessId) {
  const rec = m.gd.chess(chessId);
  if (!rec) return fail(ERR.BAD_TARGET, `unknown chess ${short(chessId)}`);
  const piece = ps.acquireChess(chessId, { source: 'console' });
  if (!piece) return fail(ERR.HAND_FULL);
  logged(m, ps, `granted chess ${chessId} (uid ${piece.uid}${piece.id === chessId ? '' : ` → ${piece.id} merge`})`);
  return OK;
}

/** Grant an item. HAND_FULL when hand and temp are both full and it does not complete a merge. */
export function dbgItem(m, ps, itemId) {
  const rec = m.gd.item(itemId);
  if (!rec) return fail(ERR.BAD_TARGET, `unknown item ${short(itemId)}`);
  const piece = ps.acquireItem(itemId, { source: 'console' });
  if (!piece) return fail(ERR.HAND_FULL);
  logged(m, ps, `granted item ${itemId} (uid ${piece.uid})`);
  return OK;
}

/** Set 资金 outright (the protocol already bounds it to CONSOLE_LIMITS.funds). */
export function dbgFunds(m, ps, funds) {
  const to = Math.max(0, Math.trunc(funds));
  const from = ps.funds;
  ps.funds = to;
  // the funds card is a private view; the stats (fundsGained / gold) are the player's own record and stay untouched
  ps.dirty();
  logged(m, ps, `funds ${from} → ${to}`);
  return OK;
}

/**
 * Set one bond's layers outright. 0 forgets the bond (the state an untouched bond has — computeBonds reads a missing
 * entry as 0). The bond must be one of the match's data, mode-inactive bonds included (they hold layers that never
 * matter while the mode has them off — the same state a FUNNY match keeps).
 */
export function dbgLayers(m, ps, bondId, layers) {
  if (!m.gd.bond(bondId)) return fail(ERR.BAD_TARGET, `unknown bond ${short(bondId)}`);
  const to = Math.max(0, Math.min(Math.trunc(layers), BOND_LAYER_CAP));
  const from = Number.isFinite(ps.layers[bondId]) && ps.layers[bondId] > 0 ? ps.layers[bondId] : 0;
  if (to > 0) ps.layers[bondId] = to;
  else delete ps.layers[bondId];
  ps.recompute(); // the views (and the next battle's bond snapshot) read ps.layers
  logged(m, ps, `${bondId} layers ${from} → ${to}`);
  return OK;
}

/**
 * Set the 调度中心 level and re-roll the shop for that level's slot count. Above the mode's maxShopLevel is a
 * BAD_TARGET; the frozen, unsold slots survive the re-roll (the level-up handle itself does not touch the slots — the
 * shop follows the level at the next refresh / round start —, but a tester who sets a level wants to see its shop).
 */
export function dbgLevel(m, ps, level) {
  const max = m.gd.maxShopLevel;
  const to = Math.max(1, Math.min(Math.trunc(level), max));
  if (level > max) return fail(ERR.BAD_TARGET, `level above ${max}`);
  const from = ps.shop.level;
  if (to !== from) ps.shop.level = to;
  ps.shop.upgradePrice = to >= max ? 0 : (m.gd.upgradeBase(to) ?? 0);
  ps.rollShop({ keepFrozen: true });
  if (to !== from) m.tickerFor('SHOP_LEVEL', [ps.name, String(to)], { playerId: ps.playerId, param: String(to) });
  logged(m, ps, `shop level ${from} → ${to}`);
  return OK;
}
