// The debug console (DESIGN §21.33) — the in-match test panel: grant ANY operator or item, set 资金, 盟约层数 and the
// 调度中心 level outright, so a tester can look at a state (a bond at 200 layers, an elite nobody owns, a level-6 shop)
// without playing the rounds that would reach it.
//
// The panel is offered only when the server said so: `m.private.console` (PlayerState.console), which the lobby sets
// from the connection — a loopback client (the packaged app, a desktop dev browser), or everyone under SP_CONSOLE=1
// (server/lobby.js consoleAllowed). Every op is a `g.dbg*` intent (shared/protocol.js) handled by
// server/match/console.js, so the panel never mutates state itself: it sends, and the next `m.private` push redraws the
// game (this panel included).
//
// Contents: four tabs — 干员 (every chess record of the data; its elite behind 精锐), 装备 (every item, 非商店 / 奇术
// marked), 资源 (资金, 调度中心等级, a status line), 盟约 (every bond with its current layers and ± steps) — a
// search / tier filter over the lists, and a command line (`chess 银灰`, `item 苦艾`, `funds 30`, `bond 谢拉格 +5`,
// `level 6`, `help`) for the keyboard. The pure half of the file (rows, filters, the command parser) is hookless and
// unit-tested by test/ui/console.test.js; screens/game.js mounts the panel and owns its key.
//
// Styles: css/screens/game-console.css. Player-facing text: docs/PLAYING.md §调试控制台.

import { useState, useMemo, useRef, useEffect } from '../../vendor/hooks.module.js';
import { html, Button, MicroLabel, Tabs } from './components.js';
import { UnitThumb, ItemIcon, BondGlyph } from './gameComponents.js';
import { modeOffBonds } from './gameLogic.js';
import { getMode } from '../data.js';
import { actions } from './gameActions.js';
import { CONSOLE_LIMITS } from '../../../shared/constants.js';
import { t, N_ } from '../../../shared/i18n.js';

const cx = (...p) => p.flat().filter(Boolean).join(' ');

/** The key that opens / closes the panel (screens/game.js; also printed on its button). */
export const CONSOLE_KEY = '`';
/** Tabs of the panel, in order. */
export const CONSOLE_TABS = Object.freeze([
  { id: 'chess', label: N_('干员') }, { id: 'items', label: N_('装备') }, { id: 'res', label: N_('资源') }, { id: 'bonds', label: N_('盟约') },
]);
/** The tiers the 干员 / 装备 filter offers. */
export const CONSOLE_TIERS = Object.freeze([1, 2, 3, 4, 5, 6]);
/** Quick 资金 steps of the 资源 tab. */
export const FUNDS_STEPS = Object.freeze([1, 5, 20]);
/** Bond layer steps of the 盟约 tab (the ± pair) — the direct "设为" field sits next to them. */
export const LAYER_STEPS = Object.freeze([1, 10]);
/** How many command log lines the panel keeps (the box shows the newest ones; older ones clip at its top). */
export const LOG_LINES = 6;

// ---- pure model ----------------------------------------------------------------------------------------------------

/** Lowercase search terms of a query (`'银 灰'` → ['银', '灰'] — every term must match). */
export function searchTerms(text) {
  return String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether every term appears in the (lowercased) haystack. */
export const matchesTerms = (hay, terms) => terms.every((t) => hay.includes(t));

/**
 * One 干员 row.
 * @param {any} rec chess.json record (a base record: `!isGolden`)
 * @param {(id: string) => any} bondOf bond lookup (names for the chips and the search)
 * @returns {{ id: string, goldenId: string|null, name: string, tier: number, profession: string, sub: string,
 *   bonds: Array<{ id: string, name: string }>, rare: boolean, hay: string, rec: any }}
 */
export function chessRow(rec, bondOf = () => null) {
  const bonds = (Array.isArray(rec?.bonds) ? rec.bonds : []).map((id) => ({ id, name: bondOf(id)?.name || id }));
  const name = String(rec?.name || rec?.chessId || '');
  const profession = String(rec?.profession || '');
  const sub = String(rec?.subProfessionName || '');
  const rare = !!(rec?.isHidden || rec?.isDiy);
  const hay = [name, rec?.chessId, rec?.appellation, profession, sub, ...bonds.map((b) => b.name)]
    .filter(Boolean).join(' ').toLowerCase();
  return { id: rec?.chessId ?? null, goldenId: rec?.goldenId || null, name, tier: rec?.tier ?? 0, profession, sub, bonds, rare, hay, rec };
}

/** One 装备 row. */
export function itemRow(rec) {
  const name = String(rec?.name || rec?.id || '');
  const rare = !!(rec?.hideInShop || rec?.shopExcluded);
  const hay = [name, rec?.id, rec?.effectName, rec?.desc, rec?.itemType, rare ? t('非商店') : '']
    .filter(Boolean).join(' ').toLowerCase();
  return { id: rec?.id ?? null, name, tier: rec?.tier ?? 0, magic: rec?.itemType === 'MAGIC', rare, desc: String(rec?.desc || ''), hay, rec };
}

/** One 盟约 row: the data record + this player's current state (m.private.bonds). */
export function bondRow(rec, priv, off = false) {
  const entry = (Array.isArray(priv?.bonds) ? priv.bonds : []).find((b) => b && b.bondId === rec.bondId) || null;
  return {
    id: rec.bondId, name: String(rec.name || rec.bondId), off,
    layers: Number.isFinite(entry?.layers) ? entry.layers : 0,
    count: Number.isFinite(entry?.count) ? entry.count : 0,
    tier: Number.isFinite(entry?.tier) ? entry.tier : 0,
    active: !!entry?.active,
    thresholds: Array.isArray(entry?.thresholds) ? entry.thresholds : (Array.isArray(rec.thresholds) ? rec.thresholds : []),
    rec,
  };
}

/**
 * The rows one tab shows for a query / tier filter.
 * @param {'chess'|'items'|'bonds'|'res'} tab
 * @param {{ gd: any, priv: any, pub: any, query?: string, tier?: number|'all', extra?: boolean, mode?: any }} opts
 *   `extra`: include the odd ones — 隐藏 / 内置 chess, 非商店 items, 本局禁用 bonds (the bonds list always carries them,
 *   tagged, once the toggle is on); `mode`: the config.json mode record the 本局禁用 set comes from (default: pub.modeId)
 */
export function consoleRows(tab, { gd, priv, pub, query = '', tier = 'all', extra = false, mode = null }) {
  const terms = searchTerms(query);
  const wantTier = tier === 'all' ? null : Number(tier);
  const byTierThenSort = (a, b) => a.tier - b.tier
    || (a.rec.shopSortId ?? a.rec.identifier ?? 0) - (b.rec.shopSortId ?? b.rec.identifier ?? 0)
    || a.name.localeCompare(b.name);
  if (tab === 'chess') {
    const rows = (gd.list('chess') || [])
      .filter((c) => c && c.chessId && !c.isGolden && (c.visible || (extra && (c.isHidden || c.isDiy))))
      .map((c) => chessRow(c, gd.bond))
      .filter((r) => (wantTier == null || r.tier === wantTier) && matchesTerms(r.hay, terms));
    return rows.sort(byTierThenSort);
  }
  if (tab === 'items') {
    const rows = (gd.list('items') || [])
      .filter((i) => i && i.id && !i.isGolden && (extra || !(i.hideInShop || i.shopExcluded)))
      .map(itemRow)
      .filter((r) => (wantTier == null || r.tier === wantTier) && matchesTerms(r.hay, terms));
    return rows.sort(byTierThenSort);
  }
  if (tab === 'bonds') {
    const off = modeOffBonds(mode ?? getMode(pub?.modeId));
    const rows = (gd.list('bonds') || [])
      .filter((b) => b && b.bondId && (!off.has(b.bondId) || extra))
      .map((b) => bondRow(b, priv, off.has(b.bondId)))
      .filter((r) => matchesTerms(`${r.name} ${r.id}`.toLowerCase(), terms));
    // the data order (bondOrder, then identifier) — never re-sorted by layers: the row a tester is stepping must not jump
    return rows.sort((a, b) => (a.rec.bondOrder ?? 0) - (b.rec.bondOrder ?? 0)
      || (a.rec.identifier ?? 0) - (b.rec.identifier ?? 0) || a.name.localeCompare(b.name));
  }
  return [];
}

/** The chess id a 获得 / 精锐 button grants (the elite of the record, when it has one). */
export const grantId = (rec, elite = false) => (elite && rec?.goldenId ? rec.goldenId : rec?.chessId || rec?.id || null);

/** Clamp a 资金 value into what the server accepts (g.dbgFunds: 0 … CONSOLE_LIMITS.funds). */
export const clampFunds = (n) => Math.max(0, Math.min(Math.round(Number(n) || 0), CONSOLE_LIMITS.funds));
/** The funds a ± step lands on. */
export const fundsStep = (cur, delta) => clampFunds((Number(cur) || 0) + delta);

/** Clamp 盟约层数 into what the server accepts (g.dbgLayers: 0 … the official 999 cap). */
export const clampLayers = (n) => Math.max(0, Math.min(Math.round(Number(n) || 0), CONSOLE_LIMITS.layers));
/** The layers a ± step lands on. */
export const layerStep = (cur, delta) => clampLayers((Number(cur) || 0) + delta);

/** A short status line of the state the panel acts on (the panel's header). */
export function consoleStatus(priv) {
  const hand = (Array.isArray(priv?.hand) ? priv.hand : []).filter(Boolean).length;
  const temp = (Array.isArray(priv?.temp) ? priv.temp : []).filter(Boolean).length;
  return [
    t('资金 {0}', { 0: priv?.funds ?? 0 }),
    t('等级 {0}', { 0: priv?.shop?.level ?? 1 }),
    t('整备区 {hand}/10', { hand }),
    t('临时 {temp}/5', { temp }),
    t('场上 {0}/{1}', { 0: priv?.deployCount ?? 0, 1: priv?.deployCap ?? 0 }),
  ].join(' · ');
}

// ---- the command line ----------------------------------------------------------------------------------------------

/** The commands the panel accepts (help text). */
export const COMMAND_HELP = Object.freeze([
  N_('chess <干员> [精锐] · 获得干员'),
  N_('item <装备> · 获得装备'),
  N_('funds <资金> · 设为（+20 相对）'),
  N_('bond <盟约> <层数> · 设为（+10 相对）'),
  N_('level <等级> · 设为（+1 相对）'),
  N_('help · 这份说明'),
]);

const CHESS_CMD = ['chess', N_('干员'), 'op', 'unit'];
const ITEM_CMD = ['item', N_('装备'), 'equip'];
const FUNDS_CMD = ['funds', N_('资金'), 'money', 'gold'];
const BOND_CMD = ['bond', N_('盟约'), 'layers'];
const LEVEL_CMD = ['level', N_('等级')];
const HELP_CMD = ['help', '?', N_('帮助')];
const ELITE_WORDS = [N_('精锐'), 'elite', 'e', 'golden'];

/**
 * Resolve a name or id against a list of records: an exact id, an exact name, else the unique partial match.
 * @param {any[]} list records
 * @param {string} text the typed term
 * @param {{ id?: (r: any) => string, name?: (r: any) => string, alias?: (r: any) => any[] }} [keys]
 * @returns {{ rec: any, exact: boolean } | { error: 'none'|'ambiguous', options: string[] }}
 */
export function resolveRecord(list, text, { id = (r) => r.id, name = (r) => r.name, alias = () => [] } = {}) {
  const q = String(text ?? '').trim().toLowerCase();
  const rows = (Array.isArray(list) ? list : []).filter(Boolean);
  if (!q) return { error: 'none', options: [] };
  const byId = rows.find((r) => String(id(r)).toLowerCase() === q);
  if (byId) return { rec: byId, exact: true };
  const byName = rows.find((r) => String(name(r)).toLowerCase() === q);
  if (byName) return { rec: byName, exact: true };
  const hits = rows.filter((r) => [name(r), ...alias(r)].some((v) => String(v || '').toLowerCase().includes(q)));
  if (hits.length === 1) return { rec: hits[0], exact: false };
  if (hits.length === 0) return { error: 'none', options: [] };
  return { error: 'ambiguous', options: hits.slice(0, 8).map((r) => String(name(r))) };
}

/**
 * A numeric argument: an absolute value, or a ±step against `cur`. null when it is not a number.
 * @param {string} text @param {number} cur
 */
export function numberArg(text, cur = 0) {
  const s = String(text ?? '').trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  return /^[+-]/.test(s) ? Math.round(cur) + Number(s) : Number(s);
}

/**
 * Parse one command line into an intent (never throws).
 * @param {string} text
 * @param {{ gd: any, priv: any }} ctx
 * @returns {{ t: string, fields: object, echo: string } | { help: true } | { error: string }}
 */
export function parseConsoleCommand(text, { gd, priv } = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) return { error: t('输入一条命令') };
  const parts = raw.split(/\s+/);
  const head = parts[0].toLowerCase();
  const rest = parts.slice(1);
  const chessList = (gd?.list('chess') || []).filter((c) => c && c.chessId && !c.isGolden);
  const itemList = (gd?.list('items') || []).filter((i) => i && i.id && !i.isGolden);
  const bondList = (gd?.list('bonds') || []).filter((b) => b && b.bondId);

  if (HELP_CMD.includes(head)) return { help: true };

  if (CHESS_CMD.includes(head)) {
    const elite = rest.some((w) => ELITE_WORDS.includes(w.toLowerCase()));
    const term = rest.filter((w) => !ELITE_WORDS.includes(w.toLowerCase())).join(' ');
    const r = resolveRecord(chessList, term, {
      id: (c) => c.chessId, name: (c) => c.name, alias: (c) => [c.appellation, c.subProfessionName, c.profession],
    });
    if (r.error) return { error: r.error === 'none' ? t('没有干员「{term}」', { term }) : t('「{term}」有多个候选：{1}', { term, 1: r.options.join(' / ') }) };
    const id = grantId(r.rec, elite);
    if (!id) return { error: t('{name} 没有精锐形态', { name: r.rec.name }) };
    return { t: 'g.dbgChess', fields: { chessId: id }, echo: t('获得干员 {name}{1}', { name: r.rec.name, 1: elite ? t('（精锐）') : '' }) };
  }

  if (ITEM_CMD.includes(head)) {
    const term = rest.join(' ');
    const r = resolveRecord(itemList, term, { id: (i) => i.id, name: (i) => i.name, alias: (i) => [i.effectName, i.desc] });
    if (r.error) return { error: r.error === 'none' ? t('没有装备「{term}」', { term }) : t('「{term}」有多个候选：{1}', { term, 1: r.options.join(' / ') }) };
    return { t: 'g.dbgItem', fields: { itemId: r.rec.id }, echo: t('获得装备 {name}', { name: r.rec.name }) };
  }

  if (FUNDS_CMD.includes(head)) {
    const n = numberArg(rest[0], priv?.funds ?? 0);
    if (n == null) return { error: t('资金需要一个数字（或 +20 / -20）') };
    const to = clampFunds(n);
    return { t: 'g.dbgFunds', fields: { funds: to }, echo: t('资金 → {to}', { to }) };
  }

  if (BOND_CMD.includes(head)) {
    if (rest.length < 2) return { error: t('盟约需要「名称 层数」（+10 / -10 相对）') };
    const r = resolveRecord(bondList, rest.slice(0, -1).join(' '), { id: (b) => b.bondId, name: (b) => b.name });
    const term = rest.slice(0, -1).join(' ');
    if (r.error) return { error: r.error === 'none' ? t('没有盟约「{term}」', { term }) : t('「{term}」有几个候选：{1}', { term, 1: r.options.join(' / ') }) };
    const cur = bondRow(r.rec, priv).layers;
    const n = numberArg(rest[rest.length - 1], cur);
    if (n == null) return { error: t('「{0}」不是层数（+10 / -10 相对）', { 0: rest[rest.length - 1] }) };
    const to = clampLayers(n);
    return { t: 'g.dbgLayers', fields: { bondId: r.rec.bondId, layers: to }, echo: t('{name} 层数 → {to}', { name: r.rec.name, to }) };
  }

  if (LEVEL_CMD.includes(head)) {
    const cur = priv?.shop?.level ?? 1;
    const n = numberArg(rest[0], cur);
    if (n == null) return { error: t('等级需要一个数字（或 +1 / -1）') };
    const max = Math.min(priv?.shop?.maxLevel ?? 6, CONSOLE_LIMITS.level);
    const to = Math.max(1, Math.min(Math.round(n), max));
    return { t: 'g.dbgLevel', fields: { level: to }, echo: t('调度中心等级 → {to}', { to }) };
  }

  return { error: t('未知命令「{0}」（help 看说明）', { 0: parts[0] }) };
}

// ---- panel ---------------------------------------------------------------------------------------------------------

/**
 * The debug console panel.
 *
 * It is its own overlay rather than a components.js `Modal`: the console exists to be used WHILE watching the game (a
 * bond's layers on the strip, a granted operator in the 整备区), so its backdrop is a light dim without the shared
 * modal's blur — the box keeps the modal's frame classes, and the outer div keeps the `modal` class, so
 * `shortcutBlocked` (screens/game.js) still treats it as a dialog and R / F / D / Space never act behind it. Esc and a
 * press on the backdrop close it, like every other dialog.
 * @param {{ open: boolean, onClose: () => void, pub: any, priv: any, gd: any }} props
 *   pub / priv: the match pushes; gd: the useGameData lookups (list / bond / chess / item)
 */
export function ConsolePanel({ open, onClose, pub, priv, gd }) {
  const [tab, setTab] = useState('chess');
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('all');
  const [extra, setExtra] = useState(false);
  const [cmd, setCmd] = useState('');
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const logSeq = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // the game's own Esc handling must not also run behind the panel
      closeRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // A mouse/keyboard tester goes straight to the command line (`` ` ``, type, Enter); a touch device is left alone — an
  // autofocused input pops the on-screen keyboard (the same rule as the title screen, test/ui/devices.e2e.test.js)
  useEffect(() => {
    if (!open || document.documentElement.classList.contains('sp-touch')) return;
    const t = setTimeout(() => document.querySelector('.dbg__input')?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

  const rows = useMemo(
    () => (open ? consoleRows(tab, { gd, priv, pub, query, tier, extra }) : []),
    [open, tab, gd, priv, pub, query, tier, extra],
  );

  const note = (text, tone = 'ok') => {
    logSeq.current += 1;
    // newest first: the panel renders the list reversed, so the line a click just produced is always the visible one
    setLog((l) => [...l, { id: logSeq.current, text, tone }].slice(-LOG_LINES));
  };

  /** Send one console intent through the shared `act()` wrapper (it toasts a refusal itself) and note the outcome. */
  const run = async (t, fields, echo) => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await actions.dbg(t, fields);
      note(ok ? echo : t('{echo} · 被服务器拒绝', { echo }), ok ? 'ok' : 'bad');
    } finally {
      setBusy(false);
    }
  };

  const onCommand = async () => {
    const text = cmd;
    setCmd('');
    const res = parseConsoleCommand(text, { gd, priv });
    if (res.help) { for (const line of COMMAND_HELP) note(line, 'hint'); return; }
    if (res.error) { note(res.error, 'bad'); return; }
    await run(res.t, res.fields, res.echo);
  };

  /** Backquote closes the panel while one of its inputs has the focus (the game's shortcut ignores INPUT targets). */
  const keyDown = (e) => {
    if (e.key === CONSOLE_KEY || e.key === '~') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  const funds = priv?.funds ?? 0;
  const level = priv?.shop?.level ?? 1;
  const maxLevel = priv?.shop?.maxLevel ?? 6;
  const oddLabel = tab === 'items' ? t('非商店') : tab === 'bonds' ? t('本局禁用') : t('隐藏 / 内置');
  const oddTitle = tab === 'items' ? t('非商店 / 奇术道具') : tab === 'bonds' ? t('本局禁用的盟约（设置了也不会生效）') : t('隐藏 / 内置干员');

  if (!open) return null;
  return html`<div class="modal dbgwrap" role="presentation"
      onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal__box brackets dbgbox" role="dialog" aria-modal="true" aria-label=${t('调试控制台')} style="width:9.8rem">
      <div class="modal__stripe" aria-hidden="true"></div>
      <header class="modal__head">
        <${MicroLabel}>DEBUG CONSOLE<//>
        <h2 class="modal__title">${t('调试控制台')}</h2>
      </header>
      <div class="modal__body">
        <div class="dbg">
          <div class="dbg__bar">
            <${Tabs} items=${CONSOLE_TABS} value=${tab} onChange=${(id) => { setTab(id); setQuery(''); }} size="sm" />
            <span class="dbg__status num">${consoleStatus(priv)}</span>
          </div>
    
          ${tab === 'res' ? html`<div class="dbg__res">
            <div class="dbg__field">
              <span class="dbg__label">${t('资金')}<${MicroLabel}>FUNDS<//></span>
              <div class="dbg__row">
                <span class="dbg__value num">${funds}</span>
                ${FUNDS_STEPS.map((n) => html`<${Button} key=${`f${n}`} size="sm" variant="primary" disabled=${busy}
                  onClick=${() => run('g.dbgFunds', { funds: fundsStep(funds, n) }, t('资金 → {0}', { 0: fundsStep(funds, n) }))}>+${n}<//>`)}
                <${Button} size="sm" variant="secondary" disabled=${busy || funds === 0}
                  onClick=${() => run('g.dbgFunds', { funds: 0 }, t('资金 → 0'))}>${t('归零')}<//>
              </div>
            </div>
            <div class="dbg__field">
              <span class="dbg__label">${t('调度中心等级')}<${MicroLabel}>SHOP LEVEL<//></span>
              <div class="dbg__row">
                <span class="dbg__value num">${level}/${maxLevel}</span>
                <${Button} size="sm" variant="secondary" disabled=${busy || level <= 1}
                  onClick=${() => run('g.dbgLevel', { level: level - 1 }, t('调度中心等级 → {0}', { 0: level - 1 }))}>−1<//>
                <${Button} size="sm" variant="secondary" disabled=${busy || level >= maxLevel}
                  onClick=${() => run('g.dbgLevel', { level: level + 1 }, t('调度中心等级 → {0}', { 0: level + 1 }))}>+1<//>
                <${Button} size="sm" variant="primary" disabled=${busy || level >= maxLevel}
                  onClick=${() => run('g.dbgLevel', { level: maxLevel }, t('调度中心等级 → {maxLevel}', { maxLevel }))}>${t('满级')}<//>
              </div>
              <p class="dbg__hint">${t('调整等级会按该等级的卡位重掷商店（已冻结的卡保留）。')}</p>
            </div>
            <p class="dbg__hint">${t('干员与装备在「干员 / 装备」标签页，也可用下方命令行：')}<b>${t('chess 银灰')}</b> · <b>${t('item 苦艾')}</b> · <b>funds +20</b> · <b>${t('bond 谢拉格 +10')}</b> · <b>level 6</b></p>
          </div>` : html`<div class="dbg__filters">
            <input class="dbg__search" type="search" value=${query} disabled=${busy}
              placeholder=${tab === 'items' ? t('搜索装备名 / 效果') : tab === 'bonds' ? t('搜索盟约') : t('搜索干员名 / 代号 / 盟约')}
              onInput=${(e) => setQuery(e.currentTarget.value)} onKeyDown=${keyDown} />
            ${tab === 'bonds' ? null : html`<div class="dbg__tiers" role="radiogroup" aria-label=${t('稀有度')}>
              <button type="button" class=${cx('dbg__tier', tier === 'all' && 'is-on')} onClick=${() => setTier('all')}>${t('全部')}</button>
              ${CONSOLE_TIERS.map((n) => html`<button key=${n} type="button" class=${cx('dbg__tier', `dbg__tier--${n}`, Number(tier) === n && 'is-on')}
                onClick=${() => setTier(n)}>${n}</button>`)}
            </div>`}
            <button type="button" class=${cx('dbg__odd', extra && 'is-on')} aria-pressed=${extra ? 'true' : 'false'} title=${oddTitle}
              onClick=${() => setExtra((v) => !v)}>${oddLabel}</button>
          </div>
    
          <div class="dbg__list" role="list">
            ${rows.length === 0 ? html`<p class="dbg__empty">${t('没有匹配的条目')}</p>` : null}
            ${rows.map((r) => (tab === 'bonds'
              ? html`<${BondRow} key=${r.id} row=${r} busy=${busy}
                  onSet=${(layers) => run('g.dbgLayers', { bondId: r.id, layers }, t('{name} 层数 → {layers}', { name: r.name, layers }))} />`
              : tab === 'items'
                ? html`<${ItemRow} key=${r.id} row=${r} busy=${busy}
                    onGrant=${() => run('g.dbgItem', { itemId: r.id }, t('获得装备 {name}', { name: r.name }))} />`
                : html`<${ChessRow} key=${r.id} row=${r} busy=${busy}
                    onGrant=${(elite) => run('g.dbgChess', { chessId: grantId(r.rec, elite) }, t('获得干员 {name}{1}', { name: r.name, 1: elite ? t('（精锐）') : '' }))} />`))}
          </div>`}
    
          <div class="dbg__cmd">
            <input class="dbg__input" type="text" value=${cmd} disabled=${busy}
              placeholder=${t('命令：chess 银灰 / item 苦艾 / funds +20 / bond 谢拉格 +10 / level 6 / help')}
              onInput=${(e) => setCmd(e.currentTarget.value)}
              onKeyDown=${(e) => { keyDown(e); if (e.key === 'Enter') onCommand(); }} />
            <${Button} size="sm" variant="primary" disabled=${busy || !cmd.trim()} onClick=${onCommand}>${t('执行')}<//>
          </div>
          <div class="dbg__log">
            ${[...log].reverse().map((l) => html`<div key=${l.id} class=${cx('dbg__logline', `is-${l.tone}`)}>${l.text}</div>`)}
            ${log.length === 0 ? html`<div class="dbg__logline is-hint">${t('就绪 · 干员 / 装备 / 资金 / 盟约层数 / 调度中心等级均可直接调整')}</div>` : null}
          </div>
        </div>
      </div>
      <footer class="modal__actions">
        <${Button} variant="secondary" icon="close" onClick=${onClose}>${t('关闭')}<//>
      </footer>
    </div>
  </div>`;
}

/** One 干员 row: thumbnail, name, tier, profession, bond chips, 获得 / 精锐. */
function ChessRow({ row, busy, onGrant }) {
  return html`<div class="dbg__item" role="listitem">
    <${UnitThumb} kind="chess" id=${row.id} size="sm" tier=${row.tier} />
    <div class="dbg__meta">
      <div class="dbg__name">${row.name}<span class="dbg__sub">${row.rec.appellation || ''}</span></div>
      <div class="dbg__tags">
        <span class="dbg__tag">${row.sub || row.profession}</span>
        ${row.bonds.slice(0, 4).map((b) => html`<span key=${b.id} class="dbg__tag dbg__tag--bond"><${BondGlyph} bondId=${b.id} />${b.name}</span>`)}
        ${row.rare ? html`<span class="dbg__tag dbg__tag--rare">${t('隐藏')}</span>` : null}
      </div>
    </div>
    <div class="dbg__ops">
      <${Button} size="sm" variant="primary" disabled=${busy} onClick=${() => onGrant(false)}>${t('获得')}<//>
      ${row.goldenId ? html`<${Button} size="sm" variant="secondary" disabled=${busy} title=${t('以精锐形态获得')} onClick=${() => onGrant(true)}>${t('精锐')}<//>` : null}
    </div>
  </div>`;
}

/** One 装备 row. */
function ItemRow({ row, busy, onGrant }) {
  return html`<div class="dbg__item" role="listitem">
    <${ItemIcon} itemId=${row.id} size="sm" />
    <div class="dbg__meta">
      <div class="dbg__name">${row.name}</div>
      <div class="dbg__tags">
        <span class="dbg__tag">T${row.tier}</span>
        ${row.magic ? html`<span class="dbg__tag dbg__tag--rare">${t('奇术')}</span>` : null}
        ${row.rare ? html`<span class="dbg__tag dbg__tag--rare">${t('非商店')}</span>` : null}
        ${row.desc ? html`<span class="dbg__tag dbg__tag--desc">${row.desc}</span>` : null}
      </div>
    </div>
    <div class="dbg__ops">
      <${Button} size="sm" variant="primary" disabled=${busy} onClick=${onGrant}>${t('获得')}<//>
    </div>
  </div>`;
}

/** One 盟约 row: current layers, the ± steps and a direct set field. */
function BondRow({ row, busy, onSet }) {
  const [value, setValue] = useState('');
  const set = () => {
    const n = numberArg(value, row.layers);
    if (n == null) return;
    onSet(clampLayers(n));
    setValue('');
  };
  return html`<div class=${cx('dbg__item', 'dbg__item--bond', row.off && 'is-off')} role="listitem">
    <${BondGlyph} bondId=${row.id} />
    <div class="dbg__meta">
      <div class="dbg__name">${row.name}${row.off ? html`<span class="dbg__tag dbg__tag--rare">${t('本局禁用')}</span>` : null}</div>
      <div class="dbg__tags">
        <span class=${cx('dbg__tag', row.active && 'dbg__tag--on')}>${row.active ? t('已激活 T{tier}', { tier: row.tier }) : t('未激活')}</span>
        <span class="dbg__tag">${t('成员 {count}', { count: row.count })}${row.thresholds.length ? ` / ${row.thresholds.join('·')}` : ''}</span>
      </div>
    </div>
    <div class="dbg__ops dbg__ops--bond">
      <span class="dbg__value num">${t('层 {layers}', { layers: row.layers })}</span>
      ${[-LAYER_STEPS[1], -LAYER_STEPS[0], LAYER_STEPS[0], LAYER_STEPS[1]].map((d) => html`<${Button} key=${d} size="sm" variant="secondary"
        disabled=${busy || (d < 0 && row.layers === 0)} onClick=${() => onSet(layerStep(row.layers, d))}>${d > 0 ? `+${d}` : d}<//>`)}
      <input class="dbg__num" type="text" inputmode="numeric" value=${value} placeholder=${t('设为')} disabled=${busy}
        onInput=${(e) => setValue(e.currentTarget.value)} onKeyDown=${(e) => { if (e.key === 'Enter') set(); }} />
      <${Button} size="sm" variant="primary" disabled=${busy || !value.trim()} onClick=${set}>✓<//>
    </div>
  </div>`;
}
