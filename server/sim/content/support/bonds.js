// server/sim/content/support/bonds.js — a unit's own bonds, in a module the kit files may import.
//
// Why it is not in support/index.js: a kit file may not import an index module (an import cycle — see
// test/content/kits_layout.test.js), and the kits need this rule since 0.2.0 (the fork's DESIGN §21.31/§21.43:
// "【X】干员 / 【X】势力的干员" is the 盟约's membership, not the character's nation). support/index.js re-exports
// `unitBonds` from here, so every existing caller keeps importing it from support/index.js.

import { getData } from '../../../data.js';

const EMPTY = Object.freeze([]);
const own = (o, k) => (o && typeof o === 'object' && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
const QUIET = Object.freeze({ warn() {}, error() {}, info() {} });
const isOp = (u) => !!u && u.kind === 'op';
const itemsOf = (u) => (u && Array.isArray(u.items) ? u.items : EMPTY);

let DATA = null;
/** Frozen data/*.json (the process singleton of server/data.js; the same object support/index.js caches). */
const gameData = () => {
  if (!DATA) {
    try { DATA = getData({ log: QUIET }) || {}; } catch { DATA = {}; }
  }
  return DATA;
};

const BONDS = new WeakMap();
/**
 * A unit's own bonds: the chess's data bonds + bonds granted by 变形同构体 (an item with `canGiveBond` worn together
 * with an item that has a `giveBondId`; same rule as server/match/bondsMeta.js pieceBonds). Tokens / enemies: [].
 */
export function unitBonds(u) {
  if (!isOp(u)) return EMPTY;
  const cached = BONDS.get(u);
  const items = itemsOf(u);
  const key = items.join('|');
  if (cached && cached.key === key) return cached.bonds;
  const out = [...(Array.isArray(u.def?.bonds) ? u.def.bonds : Array.isArray(u.def?.raw?.bonds) ? u.def.raw.bonds : [])];
  if (items.length >= 2) {
    const recs = items.map((id) => own(gameData().items, id)).filter(Boolean);
    if (recs.some((r) => r.canGiveBond)) {
      for (const r of recs) {
        if (r.canGiveBond) continue;
        if (typeof r.giveBondId === 'string' && own(gameData().bonds, r.giveBondId) && !out.includes(r.giveBondId)) out.push(r.giveBondId);
      }
    }
  }
  const bonds = Object.freeze(out);
  BONDS.set(u, { key, bonds });
  return bonds;
}
